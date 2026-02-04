import requests
from app.config import GEMINI_API_KEY
import logging
import json

logger = logging.getLogger(__name__)

def get_available_models(api_version="v1beta"):
    """List available models from the Gemini API"""
    try:
        url = f"https://generativelanguage.googleapis.com/{api_version}/models"
        response = requests.get(f"{url}?key={GEMINI_API_KEY}", timeout=10)
        if response.status_code == 200:
            result = response.json()
            models = [model["name"].split("/")[-1] for model in result.get("models", [])]
            return models
    except Exception as e:
        logger.warning(f"Could not list models: {str(e)}")
    return []

def gemini(prompt: str):
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured. Please set it in environment variables.")
    
    # Try to get available models first
    available_models = get_available_models("v1beta")
    if not available_models:
        available_models = get_available_models("v1")
    
    # Priority order of models to try (most preferred first)
    preferred_models = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro-latest", 
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-pro",
        "gemini-1.0-pro",
    ]
    
    # Filter to only models that are available
    models_to_try = [m for m in preferred_models if m in available_models] if available_models else preferred_models
    
    # Also try the available models we found
    if available_models:
        for model in available_models:
            if model not in models_to_try and "gemini" in model.lower():
                models_to_try.append(model)
    
    # Try different API versions
    api_versions = ["v1beta", "v1"]
    
    last_error = None
    
    for api_version in api_versions:
        for model_name in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent"
                
                response = requests.post(
                    f"{url}?key={GEMINI_API_KEY}",
                    json={
                        "contents": [{"parts": [{"text": prompt}]}]
                    },
                    headers={
                        "Content-Type": "application/json"
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    if "candidates" not in result or len(result["candidates"]) == 0:
                        logger.warning(f"Model {model_name} (v{api_version}) returned empty candidates")
                        continue
                    
                    logger.info(f"Successfully used model {model_name} (v{api_version})")
                    return result["candidates"][0]["content"]["parts"][0]["text"]
                
                # Log the error but continue trying
                if response.status_code != 200:
                    error_text = response.text[:300] if response.text else "No error message"
                    logger.warning(f"Model {model_name} (v{api_version}) returned {response.status_code}: {error_text}")
                    last_error = f"Status {response.status_code}: {error_text}"
                    
            except requests.exceptions.RequestException as e:
                logger.warning(f"Request error with {model_name} (v{api_version}): {str(e)}")
                last_error = str(e)
                continue
    
    # If we get here, all models failed
    logger.error(f"All Gemini API models failed. Last error: {last_error}")
    
    # Provide helpful error message
    available_info = ""
    if available_models:
        available_info = f"\n\nAvailable models found: {', '.join(available_models[:5])}"
    else:
        available_info = "\n\nCould not retrieve list of available models."
    
    error_msg = (
        "Unable to connect to Gemini API. Please verify:\n"
        "1. Billing is enabled on your Google Cloud project (REQUIRED - go to https://console.cloud.google.com/billing)\n"
        "2. The Generative Language API is enabled: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n"
        "3. Your API key is correct and from the same project\n"
        "4. API key restrictions allow access to Generative Language API\n"
        f"{available_info}"
        f"\n\nLast error: {last_error if last_error else 'All models failed'}"
    )
    
    raise ValueError(error_msg)
