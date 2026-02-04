from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from googleapiclient.errors import HttpError
import logging
import base64
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

def get_gmail_service(access_token: str):
    if not access_token:
        raise ValueError("Access token is required")
    creds = Credentials(token=access_token)
    return build("gmail", "v1", credentials=creds)

def _extract_email_body(message):
    """Extract the body text from a Gmail message"""
    body = ""
    payload = message.get("payload", {})
    
    def extract_from_part(part):
        """Recursively extract text from message parts"""
        text = ""
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        elif part.get("mimeType") == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                # For HTML, we'll extract text, but prefer plain text
                html_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                # Simple HTML tag removal (basic implementation)
                text = re.sub(r'<[^>]+>', '', html_text)
        
        # Recursively check parts
        if "parts" in part:
            for subpart in part["parts"]:
                text += extract_from_part(subpart)
        
        return text
    
    # Check if message has parts
    if "parts" in payload:
        for part in payload["parts"]:
            body += extract_from_part(part)
    else:
        # Single part message
        mime_type = payload.get("mimeType", "")
        data = payload.get("body", {}).get("data", "")
        if data:
            if mime_type == "text/plain":
                body = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            elif mime_type == "text/html":
                html_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                body = re.sub(r'<[^>]+>', '', html_text)
    
    return body.strip()

def _messages_to_emails(service, message_refs):
    """Convert message list references to full email dicts with id, subject, from, snippet, date."""
    emails = []
    for msg in message_refs:
        try:
            message = service.users().messages().get(
                userId="me", id=msg["id"], format="full"
            ).execute()

            headers = message.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")
            snippet = message.get("snippet", "")
            date = next((h["value"] for h in headers if h["name"] == "Date"), "")

            emails.append({
                "id": msg["id"],
                "subject": subject,
                "from": sender,
                "snippet": snippet,
                "date": date,
            })
        except Exception as e:
            logger.warning(f"Error fetching email {msg.get('id', 'unknown')}: {str(e)}")
            continue
    return emails

def fetch_latest_emails(service, max_results=5):
    try:
        results = service.users().messages().list(
            userId="me", maxResults=max_results
        ).execute()

        emails = _messages_to_emails(service, results.get("messages", [])[:max_results])
        return emails
    except HttpError as e:
        logger.error(f"Gmail API error: {str(e)}", exc_info=True)
        error_str = str(e)
        if "accessNotConfigured" in error_str or "Gmail API has not been used" in error_str or "not been used in project" in error_str:
            error_msg = (
                "Gmail API is not enabled in your Google Cloud project. "
                "Please enable it by:\n"
                "1. Go to https://console.cloud.google.com/apis/library/gmail.googleapis.com\n"
                "2. Select your project (or create one if needed)\n"
                "3. Click 'Enable'\n"
                "4. Wait a few minutes for the changes to propagate\n"
                "5. Try again"
            )
            raise ValueError(error_msg)
        raise ValueError(f"Failed to fetch emails from Gmail. Please check your Google Cloud project settings and ensure the Gmail API is enabled.")
    except Exception as e:
        logger.error(f"Unexpected error fetching emails: {str(e)}", exc_info=True)
        raise ValueError(f"Unexpected error: {str(e)}")

def fetch_emails_by_label(service, label_id: str, max_results=5):
    """Fetch emails by Gmail label (e.g. INBOX, IMPORTANT, CATEGORY_PROMOTIONS, SPAM)."""
    try:
        results = service.users().messages().list(
            userId="me",
            labelIds=[label_id],
            maxResults=max_results,
        ).execute()
        message_refs = results.get("messages", [])[:max_results]
        return _messages_to_emails(service, message_refs)
    except HttpError as e:
        logger.error(f"Gmail API error listing by label {label_id}: {str(e)}", exc_info=True)
        error_str = str(e)
        if "accessNotConfigured" in error_str or "Gmail API has not been used" in error_str:
            error_msg = (
                "Gmail API is not enabled in your Google Cloud project. "
                "Please enable it by:\n"
                "1. Go to https://console.cloud.google.com/apis/library/gmail.googleapis.com\n"
                "2. Select your project (or create one if needed)\n"
                "3. Click 'Enable'\n"
                "4. Wait a few minutes for the changes to propagate\n"
                "5. Try again"
            )
            raise ValueError(error_msg)
        
        # For other errors, provide a cleaner message
        raise ValueError(f"Failed to fetch emails from Gmail. Please check your Google Cloud project settings and ensure the Gmail API is enabled.")
    except Exception as e:
        logger.error(f"Unexpected error fetching emails: {str(e)}", exc_info=True)
        raise ValueError(f"Unexpected error: {str(e)}")

def get_email_by_id(service, email_id: str):
    """Get full email content by ID"""
    try:
        message = service.users().messages().get(
            userId="me", id=email_id, format="full"
        ).execute()

        headers = message.get("payload", {}).get("headers", [])
        
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
        sender = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")
        to = next((h["value"] for h in headers if h["name"] == "To"), "")
        date = next((h["value"] for h in headers if h["name"] == "Date"), "")
        
        # Extract full body
        body = _extract_email_body(message)
        
        return {
            "id": email_id,
            "subject": subject,
            "from": sender,
            "to": to,
            "date": date,
            "body": body,
            "snippet": message.get("snippet", "")
        }
    except HttpError as e:
        logger.error(f"Gmail API error fetching email {email_id}: {str(e)}", exc_info=True)
        error_str = str(e)
        if "accessNotConfigured" in error_str:
            raise ValueError("Gmail API is not enabled. Please enable it in Google Cloud Console.")
        raise ValueError(f"Failed to fetch email: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error fetching email {email_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Unexpected error: {str(e)}")

def delete_email(service, email_id: str):
    """Move an email to trash by ID (recoverable from Trash)"""
    try:
        service.users().messages().trash(userId="me", id=email_id).execute()
        return {"status": "success", "message": "Email moved to trash successfully"}
    except HttpError as e:
        logger.error(f"Gmail API error deleting email {email_id}: {str(e)}", exc_info=True)
        error_str = str(e)
        if "accessNotConfigured" in error_str:
            raise ValueError("Gmail API is not enabled. Please enable it in Google Cloud Console.")
        if "insufficientPermissions" in error_str or "insufficient authentication scopes" in error_str.lower() or "Insufficient Permission" in error_str:
            raise ValueError(
                "❌ Permission Denied: You don't have permission to delete emails.\n\n"
                "This usually happens if you logged in before the delete feature was added.\n\n"
                "**To fix this:**\n"
                "1. Log out of the application\n"
                "2. Log back in and grant all requested permissions when prompted\n"
                "3. Try deleting the email again\n\n"
                "The delete feature requires additional permissions that need to be granted during login."
            )
        if "notFound" in error_str or "404" in error_str:
            raise ValueError("Email not found. It may have already been deleted or moved to trash.")
        raise ValueError(f"Failed to move email to trash: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error moving email {email_id} to trash: {str(e)}", exc_info=True)
        raise ValueError(f"Unexpected error: {str(e)}")

def reply_to_email(service, email_id: str, reply_text: str):
    """Reply to an email"""
    try:
        # Get the original message to extract thread info
        original_message = service.users().messages().get(
            userId="me", id=email_id, format="full"
        ).execute()
        
        headers = original_message.get("payload", {}).get("headers", [])
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
        to_email = next((h["value"] for h in headers if h["name"] == "From"), "")
        
        # Extract email address from "Name <email@example.com>" format
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', to_email)
        to_address = email_match.group(0) if email_match else to_email
        
        # Create reply message
        message = MIMEText(reply_text)
        message["To"] = to_address
        message["Subject"] = f"Re: {subject}" if not subject.startswith("Re:") else subject
        message["In-Reply-To"] = original_message.get("id", "")
        message["References"] = original_message.get("id", "")
        
        # Encode message
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        
        # Send reply
        send_message = {
            "raw": raw_message,
            "threadId": original_message.get("threadId", "")
        }
        
        result = service.users().messages().send(
            userId="me", body=send_message
        ).execute()
        
        return {
            "status": "success",
            "message": "Reply sent successfully",
            "message_id": result.get("id", "")
        }
    except HttpError as e:
        logger.error(f"Gmail API error replying to email {email_id}: {str(e)}", exc_info=True)
        error_str = str(e)
        if "accessNotConfigured" in error_str:
            raise ValueError("Gmail API is not enabled. Please enable it in Google Cloud Console.")
        raise ValueError(f"Failed to send reply: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error replying to email {email_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Unexpected error: {str(e)}")
