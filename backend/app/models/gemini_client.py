"""
Gemini API Client
"""
import os
import google.generativeai as genai
from typing import Dict, Any, AsyncIterator
from dotenv import load_dotenv

load_dotenv()

class GeminiClient:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')

    async def run_gemini(
        self,
        instruction: str,
        payload: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute Gemini API request (non-streaming)"""
        try:
            # Combine instruction with payload
            prompt = f"{instruction}

Payload: {payload}

Context: {context}"

            response = self.model.generate_content(prompt)

            return {
                "model": "gemini-pro",
                "response": response.text,
                "status": "success"
            }
        except Exception as e:
            return {
                "model": "gemini-pro",
                "error": str(e),
                "status": "error"
            }

    async def run_gemini_stream(
        self,
        instruction: str,
        payload: Dict[str, Any],
        context: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:
        """Execute Gemini API request (streaming)"""
        try:
            prompt = f"{instruction}

Payload: {payload}

Context: {context}"

            response = self.model.generate_content(prompt, stream=True)

            for chunk in response:
                if chunk.text:
                    yield {
                        "model": "gemini-pro",
                        "chunk": chunk.text,
                        "status": "streaming"
                    }
        except Exception as e:
            yield {
                "model": "gemini-pro",
                "error": str(e),
                "status": "error"
            }
