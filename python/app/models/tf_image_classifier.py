
def predict(payload: dict):
    img_meta = payload.get('image', {})
    return {'label': 'cat', 'confidence': 0.92}
