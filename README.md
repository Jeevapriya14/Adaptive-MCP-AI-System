# Adaptive MCP-AI System

A full-stack AI system that intelligently routes requests to different AI models (Gemini, TensorFlow, PyTorch) based on instruction analysis and load balancing.

## Features

-  Multi-model AI routing (Gemini, TensorFlow, PyTorch)
-  WebSocket streaming support
-  Session context management with MongoDB
-  Real-time dashboard and analytics
-  Secure API key management via .env
-  React + Vite frontend with TailwindCSS

## Project Structure

```
adaptive-mcp-ai-system/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # Main API entry point
│   │   ├── core/           # Core routing & integration logic
│   │   ├── models/         # AI model integrations
│   │   └── db/             # Database layer
│   ├── .env.example        # Environment variables template
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   └── components/    # Reusable components
│   └── package.json       # Node dependencies
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:
```bash
cp .env.example .env
```

5. Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_api_key_here
MONGODB_URI=mongodb://localhost:27017
```

6. Run the backend:
```bash

cd backend
npm start
```

Backend will run on http://localhost:8000

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Frontend will run on http://localhost:3000

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Key Endpoints

- `POST /mcp/request` - Send MCP-style AI request
- `WS /ws/{session_id}` - WebSocket streaming endpoint
- `GET /session/{session_id}` - Get session context
- `GET /logs` - Get routing logs
- `GET /health` - Health check

## Usage Examples

### REST API Request

```javascript
const response = await fetch('http://localhost:8000/mcp/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    instruction: 'Analyze the sentiment of this review',
    payload: { text: 'This product is amazing!' },
    context: {}
  })
});
```

### WebSocket Streaming

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/session_123');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
ws.send(JSON.stringify({
  instruction: 'Explain quantum computing',
  payload: {}
}));
```

## Model Routing Logic

- **Keywords "image", "classify", "photo"** → TensorFlow (MobileNetV2)
- **Keywords "sentiment", "text", "review"** → PyTorch (Sentiment Analysis)
- **All other requests** → Gemini API

Load balancing ensures no single model is overloaded.

## Technologies Used

**Backend:**
- FastAPI
- Motor (async MongoDB)
- Google Generative AI (Gemini)
- TensorFlow
- PyTorch
- WebSockets

**Frontend:**
- React 18
- Vite
- TailwindCSS
- React Router

## License

MIT License

## Getting API Keys

- **Gemini API**: https://makersuite.google.com/app/apikey
- **MongoDB**: Use local instance or MongoDB Atlas (free tier)

## Support

For issues or questions, please open an issue on the repository.
