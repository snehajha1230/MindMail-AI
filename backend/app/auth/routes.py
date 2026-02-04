from fastapi import APIRouter, Request, HTTPException, Header
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.config import *
from app.auth.session import create_token
import logging
import os
import requests

router = APIRouter()
logger = logging.getLogger(__name__)

# Allow insecure transport for local development (HTTP instead of HTTPS)
# This is safe for localhost/127.0.0.1 but should NEVER be used in production
if GOOGLE_REDIRECT_URI and (
    GOOGLE_REDIRECT_URI.startswith("http://localhost") or 
    GOOGLE_REDIRECT_URI.startswith("http://127.0.0.1")
):
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "openid",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email"
]

@router.get("/login")
def login():
    try:
        # Validate environment variables
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI:
            raise HTTPException(
                status_code=500,
                detail="OAuth configuration is missing. Please check environment variables."
            )
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uris": [GOOGLE_REDIRECT_URI],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI,
        )

        auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
        return RedirectResponse(auth_url)
    except Exception as e:
        logger.error(f"Error in login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")

@router.get("/callback")
def callback(request: Request):
    try:
        # Validate environment variables
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI or not FRONTEND_URL:
            raise HTTPException(
                status_code=500,
                detail="OAuth configuration is missing. Please check environment variables."
            )
        
        # Ensure insecure transport is allowed for local development
        if GOOGLE_REDIRECT_URI and (
            GOOGLE_REDIRECT_URI.startswith("http://localhost") or 
            GOOGLE_REDIRECT_URI.startswith("http://127.0.0.1")
        ):
            os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
        
        # Check for error in callback
        error = request.query_params.get("error")
        if error:
            logger.error(f"OAuth error: {error}")
            return RedirectResponse(f"{FRONTEND_URL}/login?error={error}")
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uris": [GOOGLE_REDIRECT_URI],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI,
        )

        # Get the authorization code from the callback URL
        authorization_code = request.query_params.get("code")
        if not authorization_code:
            logger.error("No authorization code in callback")
            return RedirectResponse(f"{FRONTEND_URL}/login?error=no_code")
        
        # Fetch token using the full authorization response URL
        # Convert URL object to string properly
        authorization_response = str(request.url)
        flow.fetch_token(authorization_response=authorization_response)
        credentials = flow.credentials

        if not credentials or not credentials.token:
            logger.error("Failed to obtain credentials")
            return RedirectResponse(f"{FRONTEND_URL}/login?error=no_credentials")

        # Fetch user profile information
        user_info = {}
        try:
            # Use the OAuth2 API to get user info
            userinfo_service = build("oauth2", "v2", credentials=credentials)
            user_info_response = userinfo_service.userinfo().get().execute()
            user_info = {
                "email": user_info_response.get("email", ""),
                "name": user_info_response.get("name", ""),
                "given_name": user_info_response.get("given_name", ""),
                "family_name": user_info_response.get("family_name", ""),
                "picture": user_info_response.get("picture", ""),
            }
        except Exception as e:
            logger.warning(f"Could not fetch user info: {str(e)}")
            # Continue without user info - not critical for authentication

        # Prepare token data - refresh_token might be None if user already authorized
        token_data = {
            "access_token": credentials.token,
            "user_info": user_info,
        }
        
        if credentials.refresh_token:
            token_data["refresh_token"] = credentials.refresh_token

        token = create_token(token_data)

        return RedirectResponse(f"{FRONTEND_URL}/dashboard?token={token}")
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error in callback: {str(e)}", exc_info=True)
        # Ensure FRONTEND_URL is available before redirecting
        if FRONTEND_URL:
            return RedirectResponse(f"{FRONTEND_URL}/login?error=callback_error")
        else:
            # If FRONTEND_URL is not set, return a JSON error response
            raise HTTPException(
                status_code=500,
                detail=f"Callback error: {str(e)}. Please check server logs."
            )

@router.get("/profile")
def get_profile(authorization: str = Header(...)):
    """Get user profile from token"""
    try:
        from app.auth.session import verify_token
        # Remove "Bearer " prefix if present
        token = authorization.replace("Bearer ", "")
        token_data = verify_token(token)
        user_info = token_data.get("user_info", {})
        return user_info
    except Exception as e:
        logger.error(f"Error getting profile: {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
