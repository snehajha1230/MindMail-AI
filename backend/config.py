import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

JWT_SECRET = os.getenv("JWT_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL")
