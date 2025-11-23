"""
PyTorch Model - Sentiment Analysis
"""
import torch
from typing import Dict, Any
import re

class PyTorchModel:
    def __init__(self):
        # Simple rule-based sentiment for demo
        # In production, use transformers like DistilBERT
        self.positive_words = {
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
            'love', 'best', 'awesome', 'perfect', 'happy', 'beautiful'
        }
        self.negative_words = {
            'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate',
            'poor', 'disappointing', 'sad', 'angry', 'ugly', 'useless'
        }

    def predict_text(self, text: str) -> Dict[str, Any]:
        """Predict sentiment of text"""
        try:
            if not text:
                return {
                    "model": "pytorch-sentiment",
                    "error": "No text provided",
                    "status": "error"
                }

            # Tokenize and analyze
            words = set(re.findall(r'\w+', text.lower()))

            positive_count = len(words & self.positive_words)
            negative_count = len(words & self.negative_words)

            # Calculate sentiment
            if positive_count > negative_count:
                sentiment = "positive"
                score = min(0.9, 0.5 + (positive_count * 0.1))
            elif negative_count > positive_count:
                sentiment = "negative"
                score = min(0.9, 0.5 + (negative_count * 0.1))
            else:
                sentiment = "neutral"
                score = 0.5

            return {
                "model": "pytorch-sentiment",
                "text": text,
                "sentiment": sentiment,
                "confidence": round(score, 2),
                "positive_words_found": positive_count,
                "negative_words_found": negative_count,
                "status": "success",
                "note": "Using rule-based demo model. Replace with DistilBERT for production."
            }

        except Exception as e:
            return {
                "model": "pytorch-sentiment",
                "error": str(e),
                "status": "error"
            }
