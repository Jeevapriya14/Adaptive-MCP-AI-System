<<<<<<< HEAD
"""
Adaptive Router - Intelligently routes requests to appropriate AI models
"""
from typing import Dict, Any
import re

class AdaptiveRouter:
    def __init__(self, db):
        self.db = db
        self.model_load_counter = {
            "gemini": 0,
            "tensorflow": 0,
            "pytorch": 0
        }

    async def route(self, instruction: str, payload: Dict[str, Any]) -> str:
        """
        Route request to appropriate model based on instruction keywords
        and load balancing
        """
        instruction_lower = instruction.lower()

        # Keyword-based routing
        if any(keyword in instruction_lower for keyword in ["image", "classify", "photo", "picture", "visual", "detect"]):
            selected = "tensorflow"
        elif any(keyword in instruction_lower for keyword in ["sentiment", "text", "review", "analyze text", "emotion"]):
            selected = "pytorch"
        else:
            selected = "gemini"

        # Load balancing - if primary model is overloaded, pick least loaded
        if self.model_load_counter[selected] > 10:
            selected = min(self.model_load_counter, key=self.model_load_counter.get)

        # Increment load counter
        self.model_load_counter[selected] += 1

        # Log routing decision
        print(f"Routed to {selected} - Load counters: {self.model_load_counter}")

        return selected

    def reset_load(self, model: str):
        """Reset load counter for a model"""
        if model in self.model_load_counter:
            self.model_load_counter[model] = max(0, self.model_load_counter[model] - 1)
=======
import asyncio
import random
from typing import Dict, Any

class AdaptiveRouter:
    """A simple adaptive router stub.
    This example router keeps an internal score for each registered model service
    and picks the least-loaded one. It's a clear extension point to add
    sophisticated routing based on context, latency, and history.
    """

    def __init__(self):
        self.models = {}

    def register_model(self, model_id: str, metadata: Dict[str, Any]):
        self.models[model_id] = {
            'meta': metadata,
            'load': 0
        }

    def unregister_model(self, model_id: str):
        if model_id in self.models:
            del self.models[model_id]

    def pick_model(self, request: Dict[str, Any]) -> str:
        if not self.models:
            raise RuntimeError("No models registered")
        sorted_models = sorted(self.models.items(), key=lambda kv: kv[1]['load'])
        return sorted_models[0][0]

    async def simulate_call(self, model_id: str, request: Dict[str, Any]):
        self.models[model_id]['load'] += 1
        await asyncio.sleep(0.2 + random.random()*0.3)
        self.models[model_id]['load'] -= 1
        return {'model': model_id, 'answer': 'simulated response for:'+request.get('instruction','')}

>>>>>>> 6e09a957910bc46f66c1f75e1797b0984e2dd192
