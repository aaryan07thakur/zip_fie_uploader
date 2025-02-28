from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import zipfile
import pymongo
from bson import ObjectId
from fastapi.templating import Jinja2Templates
import uvicorn
import aiofiles
import asyncio
from concurrent.futures import ThreadPoolExecutor
from config import config

app = FastAPI()

# Initialize template engine and static files
templates = Jinja2Templates(directory=config.TEMPLATE_DIR)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")

# MongoDB setup (synchronous client)
client = pymongo.MongoClient(config.MONGO_URI)
db = client[config.DB_NAME]
collection = db[config.COLLECTION_NAME]

async def async_write_file(path: Path, content: bytes):
    """Asynchronous file write using aiofiles"""
    async with aiofiles.open(path, "wb") as buffer:
        await buffer.write(content)

async def async_extract_zip(zip_path: Path, extract_path: Path):
    """Offload ZIP extraction to thread pool"""
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as executor:
        await loop.run_in_executor(
            executor,
            lambda: zipfile.ZipFile(zip_path).extractall(extract_path)
        )

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(400, detail="Invalid ZIP file")

    unique_id = str(ObjectId())
    zip_path = config.EXTRACT_DIR / f"{unique_id}.zip"
    extract_path = config.EXTRACT_DIR / unique_id

    try:
        # Async file save
        content = await file.read()
        await async_write_file(zip_path, content)

        # Async ZIP extraction
        extract_path.mkdir(parents=True, exist_ok=True)
        await async_extract_zip(zip_path, extract_path)

        # Store metadata
        collection.insert_one({
            "unique_id": unique_id,
            "filename": file.filename,
            "file_path": str(zip_path),
            "extract_path": str(extract_path),
        })

    except zipfile.BadZipFile:
        if zip_path.exists():
            zip_path.unlink()
        raise HTTPException(400, detail="Corrupted ZIP file")
    except Exception as e:
        if zip_path.exists():
            zip_path.unlink()
        if extract_path.exists():
            extract_path.rmdir()
        raise HTTPException(500, detail=str(e))

    return RedirectResponse(f"/result/{unique_id}", status_code=303)

@app.get("/result/{unique_id}", response_class=HTMLResponse)
async def show_result(request: Request, unique_id: str):
    file_data = collection.find_one({"unique_id": unique_id})
    if not file_data:
        raise HTTPException(404, detail="File not found")

    extract_path = Path(file_data["extract_path"])
    html_file = next(extract_path.rglob("index.html"), None)
    webpage_url = f"/static/extracted/{html_file.relative_to(config.EXTRACT_DIR)}" if html_file else None

    return templates.TemplateResponse("result.html", {
        "request": request,
        "download_url": f"/download/{unique_id}",
        "contents_url": f"/list/{unique_id}",
        "webpage_url": webpage_url,
        "unique_id": unique_id,
    })

@app.get("/download/{unique_id}")
async def download_file(unique_id: str):
    file_data = collection.find_one({"unique_id": unique_id})
    if not file_data or not Path(file_data["file_path"]).exists():
        raise HTTPException(404, detail="File not found")

    return FileResponse(
        file_data["file_path"],
        media_type="application/zip",
        filename=file_data["filename"]
    )

@app.get("/list/{unique_id:path}", response_class=HTMLResponse)
async def list_files(unique_id: str):
    parts = unique_id.split('/')
    root_id = parts[0]
    sub_path = '/'.join(parts[1:]) if len(parts) > 1 else ''

    file_data = collection.find_one({"unique_id": root_id})
    if not file_data:
        raise HTTPException(404, detail="Folder not found")

    current_path = Path(file_data["extract_path"]) / sub_path
    if not current_path.is_dir():
        raise HTTPException(404, detail="Invalid directory")

    items = []
    for item in current_path.iterdir():
        is_file = item.is_file()
        rel_path = f"{unique_id}/{item.name}" if sub_path else f"{unique_id}/{item.name}"
        
        items.append({
            "name": item.name,
            "url": f"/static/extracted/{rel_path}" if is_file else f"/list/{rel_path}",
            "is_file": is_file,
            "size": item.stat().st_size if is_file else sum(
                f.stat().st_size for f in item.rglob('*') if f.is_file()
            ),
            "icon": "📄" if is_file else "📁"
        })

    items.sort(key=lambda x: (x["is_file"], x["name"].lower()))
    back_url = f"/list/{'/'.join(parts[:-1])}" if len(parts) > 1 else "/"

    return templates.TemplateResponse("file-explorer.html", {
        "request": {},
        "items": items,
        "back_url": back_url,
    })

@app.get("/download-folder/{unique_id}")
async def download_folder(unique_id: str):
    file_data = collection.find_one({"unique_id": unique_id})
    if not file_data:
        raise HTTPException(404, detail="Folder not found")

    folder_path = Path(file_data["extract_path"])
    zip_path = folder_path.with_suffix(".zip")
    
    if not zip_path.exists():
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in folder_path.rglob('*'):
                if file.is_file():
                    zipf.write(file, file.relative_to(folder_path))

    return FileResponse(zip_path, filename=f"{unique_id}.zip")

if __name__ == "__main__":
    uvicorn.run(app, host=config.HOST, port=config.PORT)