from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from app.gmail.service import (
    get_gmail_service, 
    fetch_latest_emails, 
    get_email_by_id, 
    delete_email as delete_email_service,
    reply_to_email
)
from app.auth.session import verify_token
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

def get_access_token(authorization: str = Header(...)):
    """Extract and verify the access token from the Authorization header"""
    try:
        # Remove "Bearer " prefix if present
        token = authorization.replace("Bearer ", "")
        token_data = verify_token(token)
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Invalid token: missing access_token")
        return access_token
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

class ReplyRequest(BaseModel):
    reply_text: str

@router.get("/latest")
def latest_emails(access_token=Depends(get_access_token)):
    """Get latest emails"""
    try:
        service = get_gmail_service(access_token)
        return fetch_latest_emails(service)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching latest emails: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")

@router.get("/email/{email_id}")
def get_email(email_id: str, access_token=Depends(get_access_token)):
    """Get full email content by ID"""
    try:
        service = get_gmail_service(access_token)
        return get_email_by_id(service, email_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching email {email_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch email: {str(e)}")

@router.delete("/delete/{email_id}")
def delete_email_route(email_id: str, access_token=Depends(get_access_token)):
    """Delete an email by ID"""
    try:
        service = get_gmail_service(access_token)
        result = delete_email_service(service, email_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting email {email_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete email: {str(e)}")

@router.post("/reply/{email_id}")
def reply_email_route(email_id: str, reply_request: ReplyRequest, access_token=Depends(get_access_token)):
    """Reply to an email"""
    try:
        service = get_gmail_service(access_token)
        result = reply_to_email(service, email_id, reply_request.reply_text)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error replying to email {email_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to send reply: {str(e)}")
