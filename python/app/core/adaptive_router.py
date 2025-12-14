"""
Adaptive Router - Intelligently routes requests to appropriate AI models
"""
from typing import Dict, Any


class AdaptiveRouter:
    def __init__(self, db):
        self.db = db

        self.model_load_counter = {
            "gemini": 0
        }

    async def route(self, instruction: str, payload: Dict[str, Any]) -> str:
        """
        Route request to appropriate model based on instruction.
        Gemini is used for all tasks for now.
        """

        selected = "gemini"

        if self.model_load_counter[selected] > 20:
            selected = min(self.model_load_counter, key=self.model_load_counter.get)

        self.model_load_counter[selected] += 1

        print(f"[ROUTER] Instruction → {instruction}")
        print(f"[ROUTER] Selected model → {selected}")
        print(f"[ROUTER] Load counters → {self.model_load_counter}")

        return selected

    def reset_load(self, model: str):
        """Reset load counter if needed."""
        if model in self.model_load_counter:
            self.model_load_counter[model] = 0
