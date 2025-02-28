from pathlib import Path
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

class Config:
    """Central configuration class"""

    def __init__(self):
        # Server Configuration
        self.HOST = os.getenv("HOST", "127.0.0.1")  # Default: 127.0.0.1
        self.PORT = int(os.getenv("PORT", 8000))   # Default: 8000

        # MongoDB Configuration
        self.MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        self.DB_NAME = os.getenv("DB_NAME", "file_manager")
        self.COLLECTION_NAME = os.getenv("COLLECTION_NAME", "files")

        # Directory Configuration
        self.BASE_DIR = Path(__file__).resolve().parent
        self.STATIC_DIR = self.BASE_DIR / "static"
        self.TEMPLATE_DIR = self.BASE_DIR / "templates"
        self.EXTRACT_DIR = self.STATIC_DIR / "extracted"

        # Create extraction directory on initialization
        self.EXTRACT_DIR.mkdir(parents=True, exist_ok=True)


config = Config()