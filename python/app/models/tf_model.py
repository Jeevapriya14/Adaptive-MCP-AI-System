"""
TensorFlow Model - Image Classification
"""
import tensorflow as tf
import numpy as np
from typing import Dict, Any
import base64
from io import BytesIO
from PIL import Image

class TensorFlowModel:
    def __init__(self):
        # Load pre-trained MobileNetV2
        self.model = tf.keras.applications.MobileNetV2(
            weights='imagenet',
            include_top=True
        )
        self.decode_predictions = tf.keras.applications.mobilenet_v2.decode_predictions
        self.preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input

    def predict_image(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Predict image classification"""
        try:
            # Check if payload contains image data
            if "image_url" in payload:
                return {
                    "model": "tensorflow-mobilenetv2",
                    "message": "URL-based image loading not implemented in this demo",
                    "note": "Please provide base64 encoded image",
                    "status": "info"
                }

            if "image_base64" in payload:
                # Decode base64 image
                image_data = base64.b64decode(payload["image_base64"])
                image = Image.open(BytesIO(image_data))

                # Preprocess image
                image = image.resize((224, 224))
                image_array = np.array(image)

                if len(image_array.shape) == 2:  # Grayscale
                    image_array = np.stack([image_array] * 3, axis=-1)

                image_array = np.expand_dims(image_array, axis=0)
                image_array = self.preprocess_input(image_array)

                # Make prediction
                predictions = self.model.predict(image_array)
                decoded = self.decode_predictions(predictions, top=5)[0]

                results = [
                    {
                        "class": label,
                        "description": desc,
                        "confidence": float(score)
                    }
                    for (label, desc, score) in decoded
                ]

                return {
                    "model": "tensorflow-mobilenetv2",
                    "predictions": results,
                    "top_prediction": results[0],
                    "status": "success"
                }

            # Demo mode - return sample prediction
            return {
                "model": "tensorflow-mobilenetv2",
                "message": "Demo mode - no image provided",
                "sample_predictions": [
                    {"class": "n02123045", "description": "tabby_cat", "confidence": 0.87},
                    {"class": "n02123159", "description": "tiger_cat", "confidence": 0.08},
                    {"class": "n02124075", "description": "Egyptian_cat", "confidence": 0.03}
                ],
                "note": "Provide 'image_base64' in payload for actual predictions",
                "status": "demo"
            }

        except Exception as e:
            return {
                "model": "tensorflow-mobilenetv2",
                "error": str(e),
                "status": "error"
            }
