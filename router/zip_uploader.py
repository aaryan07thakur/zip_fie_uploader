import asyncio
import json
import os
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import aiofiles
import pymongo
import uvicorn
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
router = APIRouter()



def serialize_mongo_doc(doc):
    """Convert MongoDB document to JSON-serializable format."""
    if doc is None:
        return None

    if isinstance(doc, dict):
        return {k: serialize_mongo_doc(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [serialize_mongo_doc(item) for item in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    else:
        return doc


# Load environment variables from .env file
load_dotenv()


class Config:
    """Central configuration class"""

    def __init__(self):
        # Server Configuration
        self.HOST = os.getenv("HOST", "127.0.0.1")  # Default: 127.0.0.1
        self.PORT = int(os.getenv("PORT", 8000))  # Default: 8000

        # MongoDB Configuration
        self.MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.DB_NAME = os.getenv("DB_NAME", "file_manager")
        self.COLLECTION_NAME = os.getenv("COLLECTION_NAME", "files")


config = Config()

# Define the directory for extraction
EXTRACT_DIR = "static/extracted/zip_uploader"
templates = Jinja2Templates(directory="templates/zip_uploader")

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
            executor, lambda: zipfile.ZipFile(zip_path).extractall(extract_path)
        )


@router.get("/", response_class=FileResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(400, detail="Invalid ZIP file")

    unique_id = str(ObjectId())
    zip_path = Path(EXTRACT_DIR) / f"{unique_id}.zip"
    extract_path = Path(EXTRACT_DIR) / unique_id

    try:
        # Async file save
        content = await file.read()
        await async_write_file(zip_path, content)

        # Async ZIP extraction
        extract_path.mkdir(parents=True, exist_ok=True)
        await async_extract_zip(zip_path, extract_path)

        # Check for index.html
        html_file = next(extract_path.rglob("index.html"), None)
        webpage_url = (
            f"/static/extracted/zip_uploader/{unique_id}/{html_file.relative_to(extract_path)}"
            if html_file
            else None
        )

        # Store metadata
        file_data = {
            "unique_id": unique_id,
            "filename": file.filename,
            "file_path": str(zip_path),
            "extract_path": str(extract_path),
            "webpage_url": webpage_url,
        }

        collection.insert_one(file_data)

        # Use the serialization utility function to make the data JSON-serializable
        # Return JSON response for SPA
        return JSONResponse(content=serialize_mongo_doc(file_data))

    except zipfile.BadZipFile:
        if zip_path.exists():
            zip_path.unlink()
        raise HTTPException(400, detail="Corrupted ZIP file")
    except Exception as e:
        if zip_path.exists():
            zip_path.unlink()
        if extract_path.exists():
            import shutil

            shutil.rmtree(extract_path)
        raise HTTPException(500, detail=str(e))


@router.get("/download/{unique_id}")
async def download_file(unique_id: str):
    file_data = collection.find_one({"unique_id": unique_id})
    if not file_data or not Path(file_data["file_path"]).exists():
        raise HTTPException(404, detail="File not found")

    return FileResponse(
        file_data["file_path"],
        media_type="application/zip",
        filename=file_data["filename"],
    )


@router.get("/list/{path:path}")
async def list_files(path: str):
    parts = path.split("/")
    root_id = parts[0]
    sub_path = "/".join(parts[1:]) if len(parts) > 1 else ""

    file_data = collection.find_one({"unique_id": root_id})
    if not file_data:
        raise HTTPException(404, detail="Folder not found")

    current_path = Path(file_data["extract_path"]) / sub_path
    if not current_path.is_dir():
        raise HTTPException(404, detail="Invalid directory")

    items = []
    for item in current_path.iterdir():
        is_file = item.is_file()
        rel_path = str(item.relative_to(Path(file_data["extract_path"])))

        items.append(
            {
                "name": item.name,
                "url": f"/static/extracted/zip_uploader/{root_id}/{rel_path}"
                if is_file
                else None,
                "is_file": is_file,
                "size": item.stat().st_size
                if is_file
                else sum(f.stat().st_size for f in item.rglob("*") if f.is_file()),
            }
        )

    items.sort(key=lambda x: (x["is_file"], x["name"].lower()))

    return JSONResponse(content={"items": serialize_mongo_doc(items)})


@router.get("/download-folder/{unique_id}/{path:path}")
async def download_folder(unique_id: str, path: str = ""):
    file_data = collection.find_one({"unique_id": unique_id})
    if not file_data:
        raise HTTPException(404, detail="Folder not found")

    extract_root = Path(file_data["extract_path"])

    # Determine which folder to zip
    if path:
        folder_path = extract_root / path
        if not folder_path.exists() or not folder_path.is_dir():
            raise HTTPException(404, detail="Folder not found")

        # Create a unique zip name based on folder path
        safe_path = path.replace("/", "_").replace("\\", "_")
        zip_name = f"{safe_path}.zip"
        zip_path = extract_root / zip_name
    else:
        # If no path specified, zip the entire extracted folder
        folder_path = extract_root
        zip_path = folder_path.with_suffix(".zip")
        zip_name = f"{unique_id}.zip"

    # Create a new zip file
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in folder_path.rglob("*"):
            if file.is_file():
                zipf.write(file, file.relative_to(folder_path))

    return FileResponse(zip_path, filename=zip_name)


@router.get("/check/{unique_id}")
async def check_file(unique_id: str):
    """Check if a file with the given unique ID exists and return its metadata."""
    file_data = collection.find_one({"unique_id": unique_id})

    if not file_data:
        raise HTTPException(404, detail="File not found")

    if not Path(file_data["file_path"]).exists():
        # The database record exists but the file is missing
        raise HTTPException(404, detail="File no longer available")

    # Return the file metadata
    return JSONResponse(content=serialize_mongo_doc(file_data))


# def setup_routes(app):
#     """Configure routes and static files for the main FastAPI app."""
#     # Serve static files from the output directory
#     app.mount("/output", StaticFiles(directory="output"), name="output")

#     # Mount the router
#     app.include_router(router, prefix="/tools/zip-uploader", tags=["ZIP Uploader"])
