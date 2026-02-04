from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from app.ai.gemini_client import gemini
from app.auth.session import verify_token
from app.gmail.service import get_gmail_service, fetch_latest_emails, fetch_emails_by_label, get_email_by_id, delete_email as delete_email_service, reply_to_email
import logging
import re
from typing import Optional, List, Dict
from datetime import datetime, timedelta

router = APIRouter()
logger = logging.getLogger(__name__)

class Chat(BaseModel):
    message: str

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

def _extract_email_number(message: str) -> Optional[int]:
    """Extract email number from message"""
    patterns = [
        r'email\s+(\d+)',
        r'#(\d+)',
        r'number\s+(\d+)',
        r'(\d+)(?:st|nd|rd|th)?\s+email',
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None

def _extract_sender_name(message: str) -> Optional[str]:
    """Extract sender name/email from message"""
    # Look for patterns like "from john", "from john@example.com", "by sender"
    patterns = [
        r'from\s+([^\s]+@[^\s]+)',  # Email address
        r'from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',  # Name
        r'by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',  # Name
        r'sender\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',  # Name
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None

def _extract_subject_keyword(message: str) -> Optional[str]:
    """Extract subject keyword from message"""
    patterns = [
        r'subject\s+["\']?([^"\']+)["\']?',
        r'about\s+["\']?([^"\']+)["\']?',
        r'regarding\s+["\']?([^"\']+)["\']?',
    ]
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None

def _understand_intent(message: str) -> Dict[str, any]:
    """Use AI to understand user intent"""
    prompt = f"""Analyze this user message and determine their intent. Return ONLY a JSON object with these fields:
- intent: one of ["read", "summarize", "reply", "delete", "digest", "group", "greeting", "help", "unknown"]
- parameters: object with fields like email_number, sender, subject_keyword, num_emails, etc.
- confidence: float between 0 and 1

User message: "{message}"

Return ONLY valid JSON, no other text."""

    try:
        response = gemini(prompt)
        # Try to extract JSON from response
        json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
        if json_match:
            import json
            return json.loads(json_match.group(0))
    except Exception as e:
        logger.warning(f"Could not parse AI intent: {str(e)}")
    
    # Fallback to rule-based intent detection
    message_lower = message.lower()
    intent = "unknown"
    parameters = {}
    
    if any(word in message_lower for word in ["read", "show", "list", "display", "view"]) or "view & read" in message_lower:
        intent = "read"
        num_match = re.search(r'(\d+)', message)
        parameters["num_emails"] = int(num_match.group(1)) if num_match else 5
    elif any(word in message_lower for word in ["summarize", "summary", "summarise"]) or "summarize emails" in message_lower:
        intent = "summarize"
        num_match = re.search(r'(\d+)', message)
        parameters["num_emails"] = int(num_match.group(1)) if num_match else 5
    elif any(word in message_lower for word in ["reply", "respond", "answer", "compose"]) or "reply & compose" in message_lower or "help me reply" in message_lower:
        intent = "reply"
    elif any(word in message_lower for word in ["delete", "remove", "trash", "organize"]) or "delete & organize" in message_lower or "help me delete" in message_lower:
        intent = "delete"
    elif any(word in message_lower for word in ["digest", "today", "daily", "overview"]) or "daily digest" in message_lower:
        intent = "digest"
    elif any(word in message_lower for word in ["categorize mails", "categorize emails", "show categories"]) or "categorize mails" in message_lower:
        intent = "show_categories"
    elif any(word in message_lower for word in ["group", "categorize", "category", "organize"]):
        intent = "group"
    elif any(word in message_lower for word in ["hello", "hi", "hey", "greetings"]):
        intent = "greeting"
    elif any(word in message_lower for word in ["help", "what can", "capabilities"]):
        intent = "help"
    
    return {"intent": intent, "parameters": parameters, "confidence": 0.7}

@router.get("/greeting")
def greeting(access_token: str = Depends(get_access_token)):
    """Get initial greeting with user info and capabilities"""
    try:
        token_data = verify_token(access_token.replace("Bearer ", "") if access_token.startswith("Bearer ") else access_token)
        user_info = token_data.get("user_info", {})
        user_name = user_info.get("name") or user_info.get("given_name") or "there"
        
        greeting_text = f"Hello {user_name}! 👋\n\nI'm your AI email assistant. How can I help you manage your emails today?\n\nChoose an option below to get started:"
        
        return {"reply": greeting_text, "user_info": user_info}
    except Exception as e:
        logger.error(f"Error in greeting: {str(e)}", exc_info=True)
        return {"reply": "Hello! I'm your AI email assistant. How can I help you manage your emails today?\n\nChoose an option below to get started:"}

@router.post("/message")
def chat(payload: Chat, access_token: str = Depends(get_access_token)):
    """Main chatbot endpoint with natural language understanding"""
    try:
        message = payload.message.strip()
        if not message:
            return {"reply": "Please provide a message."}
        
        message_lower = message.lower()
        
        service = get_gmail_service(access_token)
        
        # Check if message contains an email ID FIRST (user clicked an email) - priority check
        email_id_match = re.search(r'email_id:([a-zA-Z0-9_-]+)', message)
        if email_id_match:
            email_id = email_id_match.group(1)
            # Check if there's a pending action type
            action_type_match = re.search(r'action_type:([a-zA-Z]+)', message)
            action_type = action_type_match.group(1) if action_type_match else None
            
            if action_type == "read":
                return _handle_read_single_email(service, email_id)
            elif action_type == "summarize":
                return _handle_summarize_single_email(service, email_id)
            elif action_type == "reply":
                return _handle_reply_to_single_email(service, email_id)
            elif action_type == "delete":
                return _handle_delete_single_email(service, email_id)
            else:
                # If email_id found but no valid action_type, return error
                return {"reply": "I couldn't determine what action to perform. Please try clicking the email again."}
        
        # Check if user selected a category (format: "category:LABEL_ID")
        category_match = re.search(r'category:([A-Za-z0-9_-]+)', message)
        if category_match:
            label_id = category_match.group(1).upper()
            valid_labels = {"INBOX", "IMPORTANT", "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "SPAM"}
            if label_id in valid_labels:
                return _handle_emails_by_category(service, label_id)
            return {"reply": f"Unknown category. Please choose one of: All Mails, Important, Work, Promotion, Spam.", "categories": _get_categories_list()}

        # Check if user is composing a reply (format: "reply_text:email_id:actual_reply_text")
        reply_text_match = re.search(r'reply_text:([a-zA-Z0-9_-]+):(.+)', message, re.DOTALL)
        if reply_text_match:
            email_id = reply_text_match.group(1)
            reply_text = reply_text_match.group(2).strip()
            return _handle_user_composed_reply(service, email_id, reply_text)
        
        # Understand user intent
        intent_data = _understand_intent(message)
        intent = intent_data.get("intent", "unknown")
        parameters = intent_data.get("parameters", {})
        
        # Handle different intents
        if intent == "read":
            # For button clicks, show email list first
            if "view & read" in message_lower or "view read" in message_lower:
                return _handle_show_email_list(service, "read")
            num_emails = parameters.get("num_emails", 5)
            return _handle_read_emails(service, num_emails, message)
        
        elif intent == "summarize":
            # For button clicks, show email list first
            if "summarize emails" in message_lower:
                return _handle_show_email_list(service, "summarize")
            num_emails = parameters.get("num_emails", 5)
            return _handle_summarize_emails(service, num_emails, message)
        
        elif intent == "reply":
            # For button clicks, show email list first
            if "reply & compose" in message_lower or "reply compose" in message_lower:
                return _handle_show_email_list(service, "reply")
            return _handle_reply_intent(service, message, parameters)
        
        elif intent == "delete":
            # For button clicks, show email list first
            if "delete & organize" in message_lower or "delete organize" in message_lower:
                return _handle_show_email_list(service, "delete")
            return _handle_delete_intent(service, message, parameters)
        
        elif intent == "digest":
            # Daily Digest button: show digest directly
            return _handle_daily_digest(service, message)

        elif intent == "show_categories":
            # Categorize Mails button: show category choices
            return _handle_show_categories()

        elif intent == "group":
            return _handle_smart_grouping(service, message)
        
        elif intent == "greeting" or intent == "help":
            return _handle_help()
        
        else:
            # Try to infer intent from context or ask for clarification
            return _handle_unknown_intent(message, service)
            
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Value error in chat: {str(e)}", exc_info=True)
        return {"reply": str(e)}
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}", exc_info=True)
        error_msg = str(e)
        if "accessNotConfigured" in error_msg or "Gmail API has not been used" in error_msg:
            return {"reply": (
                "Gmail API is not enabled in your Google Cloud project. "
                "Please enable it by:\n"
                "1. Go to https://console.cloud.google.com/apis/library/gmail.googleapis.com\n"
                "2. Select your project (or create one if needed)\n"
                "3. Click 'Enable'\n"
                "4. Wait a few minutes for the changes to propagate\n"
                "5. Try again"
            )}
        return {"reply": f"Sorry, I encountered an error: {str(e)}. Please try again."}

def _handle_show_email_list(service, action: str):
    """Show list of emails for user to select from"""
    try:
        emails = fetch_latest_emails(service, max_results=10)
        
        if not emails:
            return {"reply": "You don't have any emails in your inbox."}
        
        action_texts = {
            "read": "read",
            "summarize": "summarize",
            "reply": "respond to",
            "delete": "delete",
        }
        
        action_text = action_texts.get(action, "process")
        
        return {
            "reply": f"Click the email you want to {action_text}:",
            "emails": emails,
            "action_type": action,
            "show_email_list": True
        }
    except Exception as e:
        logger.error(f"Error showing email list: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to fetch emails: {str(e)}")

def _handle_read_single_email(service, email_id: str):
    """Handle reading a single email by ID - returns structured data for UI"""
    try:
        full_email = get_email_by_id(service, email_id)
        email_content = {
            "from": full_email["from"],
            "to": full_email.get("to") or "N/A",
            "date": full_email.get("date") or "N/A",
            "subject": full_email["subject"],
            "body": (full_email.get("body") or "").strip(),
        }
        return {
            "reply": "Here's the email.",
            "email_id": email_id,
            "email_content": email_content,
        }
    except Exception as e:
        logger.error(f"Error reading email {email_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to read email: {str(e)}")

def _handle_summarize_single_email(service, email_id: str):
    """Handle summarizing a single email by ID"""
    try:
        full_email = get_email_by_id(service, email_id)
        
        prompt = f"""You are an email assistant. Summarize this email in 3-4 sentences, highlighting:
1. The main purpose or topic
2. Key points or action items
3. Any important details or deadlines

Email:
From: {full_email['from']}
Subject: {full_email['subject']}
Body: {full_email.get('body', '')[:1000]}

Provide a concise, professional summary:"""
        
        summary = gemini(prompt)
        
        response = f"""📧 **Email Summary**

**From:** {full_email['from']}
**Subject:** {full_email['subject']}

**AI Summary:**
{summary}"""
        
        return {"reply": response, "email_id": email_id}
    except Exception as e:
        logger.error(f"Error summarizing email {email_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to summarize email: {str(e)}")

def _handle_reply_to_single_email(service, email_id: str):
    """Handle replying to a single email by ID - ask user to compose their reply"""
    try:
        full_email = get_email_by_id(service, email_id)
        
        response = f"""📧 **Reply to Email**

**Original Email:**
From: {full_email['from']}
Subject: {full_email['subject']}

─────────────────────────────────────

{full_email.get('body', '')[:500]}{'...' if len(full_email.get('body', '')) > 500 else ''}

─────────────────────────────────────

Please type your reply below. I'll show you a preview before sending."""
        
        return {
            "reply": response,
            "email_id": email_id,
            "original_email": {
                "from": full_email['from'],
                "subject": full_email['subject']
            },
            "action_required": "compose_reply"
        }
    except Exception as e:
        logger.error(f"Error preparing reply for email {email_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to prepare reply: {str(e)}")

def _handle_user_composed_reply(service, email_id: str, reply_text: str):
    """Handle when user has composed their reply - show preview and ask for confirmation"""
    try:
        if not reply_text or not reply_text.strip():
            return {
                "reply": "Your reply is empty. Please type your reply message.",
                "email_id": email_id,
                "action_required": "compose_reply"
            }
        
        # Get original email info
        try:
            full_email = get_email_by_id(service, email_id)
            original_from = full_email['from']
            original_subject = full_email['subject']
        except:
            original_from = "Unknown"
            original_subject = "Unknown"
        
        response = f"""✉️ **Reply Preview**

**Replying to:**
From: {original_from}
Subject: {original_subject}

─────────────────────────────────────

**Your Reply:**
{reply_text}

─────────────────────────────────────

Would you like to send this reply? Type 'yes' or 'send' to confirm, or 'no' to cancel."""
        
        return {
            "reply": response,
            "email_id": email_id,
            "generated_reply": reply_text,
            "original_email": {
                "from": original_from,
                "subject": original_subject
            },
            "action_required": "confirm_send"
        }
    except Exception as e:
        logger.error(f"Error handling composed reply for email {email_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to process reply: {str(e)}")

def _handle_delete_single_email(service, email_id: str):
    """Handle deleting a single email by ID"""
    try:
        # Get email info before deleting
        try:
            email_info = get_email_by_id(service, email_id)
            subject = email_info.get("subject", "email")
            sender = email_info.get("from", "unknown")
        except:
            subject = "email"
            sender = "unknown"
        
        return {
            "reply": f"I found this email:\n\nFrom: {sender}\nSubject: {subject}\n\nAre you sure you want to delete it? (Say 'yes' or 'confirm' to delete, or 'no' to cancel)",
            "email_id": email_id,
            "action_required": "confirm_delete"
        }
    except Exception as e:
        logger.error(f"Error preparing delete for email {email_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to process delete request: {str(e)}")

def _handle_read_emails(service, num_emails: int, original_message: str):
    """Handle reading emails with AI summaries"""
    try:
        emails = fetch_latest_emails(service, max_results=num_emails)
        
        if not emails:
            return {"reply": "You don't have any emails in your inbox."}
        
        # Fetch full content and generate AI summaries
        full_emails = []
        for email in emails:
            try:
                full_email = get_email_by_id(service, email["id"])
                full_emails.append(full_email)
            except Exception as e:
                logger.warning(f"Error fetching full content for email {email['id']}: {str(e)}")
                full_emails.append({
                    "id": email["id"],
                    "subject": email["subject"],
                    "from": email["from"],
                    "body": email.get("snippet", ""),
                    "date": ""
                })
        
        # Generate AI summaries for each email
        summaries = []
        for i, email in enumerate(full_emails):
            prompt = f"""You are an email assistant. Summarize this email in 3-4 sentences, highlighting:
1. The main purpose or topic
2. Key points or action items
3. Any important details or deadlines

Email:
From: {email['from']}
Subject: {email['subject']}
Body: {email.get('body', '')[:1000]}

Provide a concise, professional summary:"""
            
            try:
                summary = gemini(prompt)
                summaries.append({
                    "email_number": i + 1,
                    "id": email["id"],
                    "from": email["from"],
                    "subject": email["subject"],
                    "summary": summary,
                    "date": email.get("date", "")
                })
            except Exception as e:
                logger.warning(f"Error generating summary for email {i+1}: {str(e)}")
                summaries.append({
                    "email_number": i + 1,
                    "id": email["id"],
                    "from": email["from"],
                    "subject": email["subject"],
                    "summary": email.get("snippet", "Summary unavailable"),
                    "date": email.get("date", "")
                })
        
        # Format response
        response_text = f"Here are your last {len(summaries)} emails with AI-generated summaries:\n\n"
        for summary in summaries:
            response_text += f"📧 **Email #{summary['email_number']}**\n"
            response_text += f"From: {summary['from']}\n"
            response_text += f"Subject: {summary['subject']}\n"
            response_text += f"Summary: {summary['summary']}\n\n"
        
        response_text += "To read a specific email in full, say 'read email [number]' or 'show me email 1'"
        
        return {"reply": response_text, "emails": summaries}
        
    except Exception as e:
        logger.error(f"Error reading emails: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to read emails: {str(e)}")

def _handle_summarize_emails(service, num_emails: int, original_message: str):
    """Handle email summarization"""
    return _handle_read_emails(service, num_emails, original_message)

def _handle_reply_intent(service, message: str, parameters: dict):
    """Handle reply generation intent"""
    try:
        # First, get emails to understand context
        emails = fetch_latest_emails(service, max_results=10)
        
        if not emails:
            return {"reply": "You don't have any emails to reply to."}
        
        # Check if user is asking for help (generic request)
        message_lower = message.lower()
        if "help me reply" in message_lower or "reply & compose" in message_lower or ("reply" in message_lower and not any(word in message_lower for word in ["email", "to", "from", "number", "#"])):
            # Show list of emails and ask which one to reply to
            emails_list = "\n".join([
                f"{i+1}. From: {email['from']}\n   Subject: {email['subject']}\n   Preview: {email.get('snippet', '')[:80]}..."
                for i, email in enumerate(emails[:10])
            ])
            return {
                "reply": f"I found {len(emails)} recent emails. Which one would you like to reply to?\n\n{emails_list}\n\nYou can:\n- Say the email number (e.g., 'email 1')\n- Say the sender name (e.g., 'reply to John')\n- Or describe the email subject",
                "emails": emails[:10]
            }
        
        # Try to identify which email to reply to
        email_number = _extract_email_number(message)
        sender = _extract_sender_name(message)
        
        target_email = None
        if email_number and 1 <= email_number <= len(emails):
            target_email = emails[email_number - 1]
        elif sender:
            # Find email from sender
            for email in emails:
                if sender.lower() in email["from"].lower():
                    target_email = email
                    break
        
        if not target_email:
            # Use the latest email
            target_email = emails[0]
        
        # Get full email content
        full_email = get_email_by_id(service, target_email["id"])
        
        # Generate AI reply
        prompt = f"""You are an email assistant helping to draft a professional reply. 

Original Email:
From: {full_email['from']}
Subject: {full_email['subject']}
Body: {full_email.get('body', '')}

User's request: "{message}"

Generate a professional, context-aware reply email. The reply should be:
- Clear and concise
- Professional in tone
- Address the points raised in the original email
- Ready to send (complete email body)

Return ONLY the reply text, no additional formatting or explanations."""
        
        reply_text = gemini(prompt)
        
        response = f"""I've generated a reply for you:

**Original Email:**
From: {full_email['from']}
Subject: {full_email['subject']}

**Generated Reply:**
{reply_text}

Would you like to send this reply? (You can confirm by saying "send" or "yes", or modify it first)"""
        
        return {
            "reply": response,
            "email_id": target_email["id"],
            "generated_reply": reply_text,
            "original_email": {
                "from": full_email['from'],
                "subject": full_email['subject']
            },
            "action_required": "confirm_send"
        }
        
    except Exception as e:
        logger.error(f"Error handling reply intent: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to generate reply: {str(e)}")

def _handle_delete_intent(service, message: str, parameters: dict):
    """Handle delete intent with natural language parsing"""
    try:
        emails = fetch_latest_emails(service, max_results=20)
        
        if not emails:
            return {"reply": "You don't have any emails to delete."}
        
        # Check if user is asking for help (generic request)
        message_lower = message.lower()
        if "help me delete" in message_lower or "delete & organize" in message_lower or ("delete" in message_lower and not any(word in message_lower for word in ["email", "from", "number", "#", "about", "subject"])):
            # Show list of emails and ask which one to delete
            emails_list = "\n".join([
                f"{i+1}. From: {email['from']}\n   Subject: {email['subject']}\n   Preview: {email.get('snippet', '')[:80]}..."
                for i, email in enumerate(emails[:10])
            ])
            return {
                "reply": f"I found {len(emails)} recent emails. Which one would you like to delete?\n\n{emails_list}\n\nYou can:\n- Say the email number (e.g., 'delete email 1')\n- Say the sender (e.g., 'delete email from john@example.com')\n- Or describe the subject (e.g., 'delete email about invoices')",
                "emails": emails[:10]
            }
        
        # Try multiple methods to identify the email
        target_email = None
        
        # Method 1: Email number
        email_number = _extract_email_number(message)
        if email_number and 1 <= email_number <= len(emails):
            target_email = emails[email_number - 1]
        
        # Method 2: Sender
        if not target_email:
            sender = _extract_sender_name(message)
            if sender:
                # Find latest email from this sender
                for email in emails:
                    if sender.lower() in email["from"].lower():
                        target_email = email
                        break
        
        # Method 3: Subject keyword
        if not target_email:
            subject_keyword = _extract_subject_keyword(message)
            if subject_keyword:
                for email in emails:
                    if subject_keyword.lower() in email["subject"].lower():
                        target_email = email
                        break
        
        if not target_email:
            # Show list and ask for clarification
            emails_list = "\n".join([
                f"{i+1}. From: {email['from']}\n   Subject: {email['subject']}"
                for i, email in enumerate(emails[:10])
            ])
            return {
                "reply": f"I found {len(emails)} emails. Which one would you like to delete?\n\n{emails_list}\n\nYou can specify by:\n- Number: 'delete email 1'\n- Sender: 'delete email from john@example.com'\n- Subject: 'delete email about invoices'",
                "emails": emails[:10]
            }
        
        # Ask for confirmation
        return {
            "reply": f"I found this email:\n\nFrom: {target_email['from']}\nSubject: {target_email['subject']}\n\nAre you sure you want to delete it? (Say 'yes' or 'confirm' to delete, or 'no' to cancel)",
            "email_id": target_email["id"],
            "action_required": "confirm_delete"
        }
        
    except Exception as e:
        logger.error(f"Error handling delete intent: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to process delete request: {str(e)}")

def _handle_daily_digest(service, message: str):
    """Handle daily digest request"""
    try:
        # Get emails from today
        emails = fetch_latest_emails(service, max_results=50)
        
        if not emails:
            return {"reply": "You don't have any emails today."}
        
        # Get full content for all emails
        full_emails = []
        for email in emails[:20]:  # Limit to 20 for digest
            try:
                full_email = get_email_by_id(service, email["id"])
                full_emails.append(full_email)
            except Exception as e:
                logger.warning(f"Error fetching email {email['id']}: {str(e)}")
                continue
        
        # Generate digest using AI
        emails_text = "\n\n".join([
            f"Email {i+1}:\nFrom: {email['from']}\nSubject: {email['subject']}\nBody: {email.get('body', '')[:500]}"
            for i, email in enumerate(full_emails)
        ])
        
        prompt = f"""You are an email assistant creating a daily digest. Analyze these emails and create a comprehensive digest that includes:

1. **Key Emails Summary**: Brief overview of the most important emails
2. **Action Items**: List any tasks, deadlines, or follow-ups needed
3. **Priority Items**: Highlight urgent or important emails
4. **Suggested Actions**: Recommendations for what the user should do

Here are today's emails:

{emails_text}

Create a well-formatted, professional daily digest."""
        
        digest = gemini(prompt)
        
        return {
            "reply": f"📊 **Your Daily Email Digest**\n\n{digest}",
            "email_count": len(full_emails)
        }
        
    except Exception as e:
        logger.error(f"Error generating daily digest: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to generate digest: {str(e)}")

def _get_categories_list():
    """Return list of category options for UI (id = Gmail label ID, label = display name)."""
    return [
        {"id": "INBOX", "label": "All Mails"},
        {"id": "IMPORTANT", "label": "Important"},
        {"id": "CATEGORY_PERSONAL", "label": "Work"},
        {"id": "CATEGORY_PROMOTIONS", "label": "Promotion"},
        {"id": "SPAM", "label": "Spam"},
    ]

def _handle_show_categories():
    """Return message and categories so frontend can show category buttons."""
    categories = _get_categories_list()
    return {
        "reply": "Select a category to see the top 5 emails:",
        "categories": categories,
        "show_category_buttons": True,
    }

def _handle_emails_by_category(service, label_id: str):
    """Fetch top 5 emails for the given Gmail label and return with action_type for clickable list."""
    try:
        emails = fetch_emails_by_label(service, label_id, max_results=5)
        if not emails:
            label_names = {c["id"]: c["label"] for c in _get_categories_list()}
            label_name = label_names.get(label_id, label_id)
            return {"reply": f"No emails found in **{label_name}**.", "emails": [], "action_type": "read"}
        label_names = {c["id"]: c["label"] for c in _get_categories_list()}
        label_name = label_names.get(label_id, label_id)
        return {
            "reply": f"Top 5 emails in **{label_name}** (click to read):",
            "emails": emails,
            "action_type": "read",
            "show_email_list": True,
        }
    except Exception as e:
        logger.error(f"Error fetching emails by category {label_id}: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to fetch emails for that category: {str(e)}")

def _handle_smart_grouping(service, message: str):
    """Handle smart inbox grouping/categorization"""
    try:
        emails = fetch_latest_emails(service, max_results=20)
        
        if not emails:
            return {"reply": "You don't have enough emails to group."}
        
        # Get full content
        full_emails = []
        for email in emails:
            try:
                full_email = get_email_by_id(service, email["id"])
                full_emails.append(full_email)
            except Exception as e:
                logger.warning(f"Error fetching email {email['id']}: {str(e)}")
                continue
        
        # Use AI to categorize emails
        emails_text = "\n\n".join([
            f"Email {i+1}:\nFrom: {email['from']}\nSubject: {email['subject']}\nBody: {email.get('body', '')[:300]}"
            for i, email in enumerate(full_emails)
        ])
        
        prompt = f"""You are an email assistant. Categorize these emails into groups like:
- Work
- Personal
- Promotions
- Urgent
- Newsletters
- Social

For each email, provide:
1. Category
2. Brief reason for categorization

Emails:
{emails_text}

Return a structured categorization with each email's number, category, and reason."""
        
        categorization = gemini(prompt)
        
        # Format response
        response = f"📁 **Smart Inbox Grouping**\n\nI've analyzed your {len(full_emails)} emails:\n\n{categorization}\n\nWould you like me to show emails from a specific category?"
        
        return {"reply": response, "email_count": len(full_emails)}
        
    except Exception as e:
        logger.error(f"Error in smart grouping: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to group emails: {str(e)}")

def _handle_help():
    """Return help message"""
    return {
        "reply": """I'm your AI email assistant! Here's what I can do:

📧 **Read Emails**: 
   - "Show me my last 5 emails"
   - "Read my emails"
   - "Display my inbox"

📝 **Summarize**: 
   - "Summarize my last 5 emails"
   - "Give me a summary of my emails"

✍️ **Generate Replies**: 
   - "Reply to email 1"
   - "Generate a response to the latest email from John"
   - "Reply to the email about invoices"

🗑️ **Delete Emails**: 
   - "Delete email 2"
   - "Delete the email from john@example.com"
   - "Delete email about invoices"

📊 **Daily Digest**: 
   - "Give me today's digest"
   - "What's my email digest for today?"

🏷️ **Smart Grouping**: 
   - "Group my emails"
   - "Categorize my inbox"

Just use natural language - I'll understand what you need!"""
    }

def _handle_unknown_intent(message: str, service):
    """Handle unknown intent - try to infer or ask for clarification"""
    prompt = f"""The user said: "{message}"

They're using an email assistant. Determine if they want to:
- Read/view emails
- Summarize emails
- Reply to an email
- Delete an email
- Get a daily digest
- Group/categorize emails
- Or just general help

Provide a helpful response that guides them on what they can do."""
    
    try:
        reply = gemini(prompt)
        return {"reply": reply}
    except Exception as e:
        logger.warning(f"Error in unknown intent handler: {str(e)}")
        return {
            "reply": "I'm not sure what you'd like to do. You can:\n- Read your emails\n- Summarize emails\n- Generate replies\n- Delete emails\n- Get a daily digest\n- Group your emails\n\nJust tell me what you need!"
        }

@router.post("/confirm-action")
def confirm_action(
    payload: dict,
    access_token: str = Depends(get_access_token)
):
    """Handle confirmation of actions (send reply, delete email)"""
    try:
        action = payload.get("action")
        email_id = payload.get("email_id")
        reply_text = payload.get("reply_text")
        confirmation = (payload.get("confirmation") or "").strip().lower()
        is_confirm = confirmation in ("yes", "confirm", "send", "y") or "yes" in confirmation or "confirm" in confirmation
        if not is_confirm:
            return {"reply": "Action cancelled.", "status": "cancelled"}
        
        service = get_gmail_service(access_token)
        
        if action == "send_reply":
            if not email_id or not reply_text:
                return {"reply": "Missing email ID or reply text.", "status": "error"}
            
            result = reply_to_email(service, email_id, reply_text)
            return {
                "reply": f"✅ Successfully sent your reply!",
                "status": "success",
                "result": result
            }
        
        elif action == "delete":
            if not email_id:
                return {"reply": "Missing email ID.", "status": "error"}
            
            # Get email info before moving to trash
            try:
                email_info = get_email_by_id(service, email_id)
                subject = email_info.get("subject", "email")
            except:
                subject = "email"
            
            result = delete_email_service(service, email_id)
            return {
                "reply": f"✅ Email moved to trash: '{subject}'. You can recover it from your Trash folder if needed.",
                "status": "success",
                "result": result
            }
        
        else:
            return {"reply": "Unknown action.", "status": "error"}
            
    except Exception as e:
        logger.error(f"Error confirming action: {str(e)}", exc_info=True)
        return {"reply": f"Failed to complete action: {str(e)}", "status": "error"}
