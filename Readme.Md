# 📁 ZIP File Upload & Explorer Web App

A FastAPI-based web application that allows users to upload ZIP files, extract them, browse the contents, and preview static websites (if available).

---

## ✅ Features

- **ZIP File Upload**  
  Accepts `.zip` files and stores them securely on disk.

- **Asynchronous Processing**  
  Uses async file writing and threaded ZIP extraction to ensure performance and avoid blocking the event loop.

- **File Extraction & Browsing**  
  Extracts ZIP contents into a unique directory and lets users explore the folder structure via a responsive UI.

- **Download Options**  
  - Download original ZIP file  
  - Download individual extracted files  
  - Re-zip and download entire folder  

- **Static Webpage Preview**  
  If an `index.html` exists in the extracted content, it is displayed as a webpage.

- **Responsive UI with Tailwind CSS**  
  Clean, modern, and mobile-friendly interface built using [Tailwind CSS](https://tailwindcss.com/). 

- **Interactive JavaScript Components**  
  Drag & drop support, context menus, modals, and dynamic navigation in the file explorer.

---

## 🛠️ Technologies Used

| Technology | Description |
|----------|-------------|
| **FastAPI** | Asynchronous Python web framework for building APIs and serving HTML templates |
| **MongoDB** | NoSQL database for storing metadata about uploaded files |
| **PyMongo** | Official MongoDB driver for Python |
| **Jinja2 Templates** | For server-side rendering of HTML pages |
| **aiofiles** | For asynchronous file I/O operations |
| **ThreadPoolExecutor** | To offload synchronous ZIP extraction tasks |
| **Tailwind CSS** | Utility-first CSS framework for styling the frontend |
| **JavaScript** | Adds interactivity to the frontend components |
| **ZIPFile Module** | Standard Python library for handling ZIP archives |

---

## 🧩 Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/zip-upload-app.git 
cd zip-upload-app

2.Install dependencies: pip install requirements.txt

3.Set up MongoDB : Make sure MongoDB is running or have access to a MongoDB Atlas instance.
4. Configure environment:
    Create a config.py file:
    # config.py
from pathlib import Path

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "zip_upload_db"
COLLECTION_NAME = "uploads"
TEMPLATE_DIR = "templates"
STATIC_DIR = "static"
EXTRACT_DIR = Path("extracted_files")
HOST = "127.0.0.1"
PORT = 8000



5.Run The app: 
uvicorn main:app --reload






