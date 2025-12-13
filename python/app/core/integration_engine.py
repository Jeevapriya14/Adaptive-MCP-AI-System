"""
Integration Engine - Executes AI models and manages responses
"""
from typing import Dict, Any, AsyncIterator
from app.models.gemini_client import GeminiClient


class IntegrationEngine:
    def __init__(self, db):
        self.db = db
        self.gemini = GeminiClient()   # Only Gemini model enabled

    # ---------------------------------------------------------
    # NON-STREAMING EXECUTION
    # ---------------------------------------------------------
    async def execute(
        self,
        model_name: str,
        instruction: str,
        payload: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:

        try:
            if model_name == "gemini":
                result = await self.gemini.run_gemini(
                    instruction, payload, context
                )
            else:
                result = {"error": f"Unknown model: {model_name}"}

            return result

        except Exception as e:
            return {"error": str(e)}

    # ---------------------------------------------------------
    # STREAMING EXECUTION
    # ---------------------------------------------------------
    async def execute_stream(
        self,
        model_name: str,
        instruction: str,
        payload: Dict[str, Any],
        context: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:

        try:
            if model_name == "gemini":
                async for chunk in self.gemini.run_gemini_stream(
                    instruction, payload, context
                ):
                    yield chunk
            else:
                yield {"error": f"Unknown model: {model_name}"}

        except Exception as e:
            yield {"error": str(e)}
