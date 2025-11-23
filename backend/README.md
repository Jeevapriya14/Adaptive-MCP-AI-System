# Adaptive MCP-AI System - Backend

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

3. Edit `.env` and add your Gemini API key

4. Run the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Endpoints

- `POST /mcp/request` - Send MCP-style AI request
- `WS /ws/{session_id}` - WebSocket streaming endpoint
- `GET /session/{session_id}` - Get session context
- `GET /logs` - Get routing logs
- `GET /health` - Health check
