
def predict(payload: dict):
    text = payload.get('text', '')
    return {'label': 'positive', 'score': 0.87}
