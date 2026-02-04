from jose import jwt
from datetime import datetime, timedelta
from app.config import JWT_SECRET
import logging

logger = logging.getLogger(__name__)
ALGORITHM = "HS256"

def create_token(data: dict):
    if not JWT_SECRET:
        raise ValueError("JWT_SECRET is not configured. Please set it in environment variables.")
    try:
        payload = data.copy()
        payload["exp"] = datetime.utcnow() + timedelta(hours=1)
        return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)
    except Exception as e:
        logger.error(f"Error creating token: {str(e)}", exc_info=True)
        raise

def verify_token(token: str):
    if not JWT_SECRET:
        raise ValueError("JWT_SECRET is not configured. Please set it in environment variables.")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except Exception as e:
        logger.error(f"Error verifying token: {str(e)}", exc_info=True)
        raise
