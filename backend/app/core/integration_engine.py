<<<<<<< HEAD
"""
Integration Engine - Executes AI models and manages responses
"""
from typing import Dict, Any, AsyncIterator
from app.models.gemini_client import GeminiClient
from app.models.tf_model import TensorFlowModel
from app.models.torch_model import PyTorchModel

class IntegrationEngine:
    def __init__(self, db):
        self.db = db
        self.gemini = GeminiClient()
        self.tf_model = TensorFlowModel()
        self.torch_model = PyTorchModel()

    async def execute(
        self,
        model_name: str,
        instruction: str,
        payload: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute the selected AI model"""
        try:
            if model_name == "gemini":
                result = await self.gemini.run_gemini(instruction, payload, context)
            elif model_name == "tensorflow":
                result = self.tf_model.predict_image(payload)
            elif model_name == "pytorch":
                result = self.torch_model.predict_text(payload.get("text", instruction))
            else:
                result = {"error": f"Unknown model: {model_name}"}

            return result

        except Exception as e:
            return {"error": str(e)}

    async def execute_stream(
        self,
        model_name: str,
        instruction: str,
        payload: Dict[str, Any],
        context: Dict[str, Any]
    ) -> AsyncIterator[Dict[str, Any]]:
        """Execute with streaming response"""
        try:
            if model_name == "gemini":
                async for chunk in self.gemini.run_gemini_stream(instruction, payload, context):
                    yield chunk
            elif model_name == "tensorflow":
                result = self.tf_model.predict_image(payload)
                yield result
            elif model_name == "pytorch":
                result = self.torch_model.predict_text(payload.get("text", instruction))
                yield result
            else:
                yield {"error": f"Unknown model: {model_name}"}

        except Exception as e:
            yield {"error": str(e)}
=======
import asyncio
from .adaptive_router import AdaptiveRouter
import json

class IntegrationEngine:
    def __init__(self, router: AdaptiveRouter):
        self.router = router
        self.router.register_model('tf_image_classifier', {'type':'tf','desc':'demo tf'})
        self.router.register_model('torch_text_classifier', {'type':'torch','desc':'demo torch'})
        self.router.register_model('openai_llm', {'type':'llm','desc':'openai/gemini'})

    async def handle_request(self, req: dict, stream: bool=False, websocket=None):
        model_id = self.router.pick_model(req)
        resp = await self.router.simulate_call(model_id, req)
        if stream and websocket:
            await websocket.send_text(json.dumps({'partial': f"Started on {model_id}"}))
            await websocket.send_text(json.dumps({'partial': resp}))
            return None
        return resp
>>>>>>> 6e09a957910bc46f66c1f75e1797b0984e2dd192
