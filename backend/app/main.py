<<<<<<< HEAD
"""
FastAPI Backend for Adaptive MCP-AI System
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import json
from datetime import datetime

from app.core.adaptive_router import AdaptiveRouter
from app.core.integration_engine import IntegrationEngine
from app.core.data_synchronizer import DataSynchronizer
from app.db.mongo import MongoDB

app = FastAPI(title="Adaptive MCP-AI System")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
=======
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .core.adaptive_router import AdaptiveRouter
from .core.integration_engine import IntegrationEngine
from pydantic import BaseModel
import uuid

app = FastAPI(title="Adaptive MCP-AI System - Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
>>>>>>> 6e09a957910bc46f66c1f75e1797b0984e2dd192
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< HEAD
# Initialize components
db = MongoDB()
router = AdaptiveRouter(db)
engine = IntegrationEngine(db)
synchronizer = DataSynchronizer(db)

class MCPRequest(BaseModel):
    session_id: Optional[str] = None
    instruction: str
    context: Optional[Dict[str, Any]] = {}
    payload: Optional[Dict[str, Any]] = {}

@app.on_event("startup")
async def startup_event():
    """Initialize database connection"""
    await db.connect()

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection"""
    await db.disconnect()

@app.get("/")
async def root():
    return {
        "message": "Adaptive MCP-AI System API",
        "version": "1.0.0",
        "endpoints": {
            "mcp_request": "/mcp/request",
            "websocket": "/ws/{session_id}",
            "session_context": "/session/{session_id}",
            "routing_logs": "/logs"
        }
    }

@app.post("/mcp/request")
async def mcp_request(request: MCPRequest):
    """Handle MCP-style AI requests"""
    try:
        # Generate session_id if not provided
        session_id = request.session_id or str(uuid.uuid4())

        # Get or create session context
        session_context = await synchronizer.get_context(session_id)
        if session_context is None:
            session_context = {
                "session_id": session_id,
                "created_at": datetime.utcnow().isoformat(),
                "messages": [],
                "context": request.context or {}
            }

        # Save incoming request to DB
        await db.save_request({
            "session_id": session_id,
            "instruction": request.instruction,
            "payload": request.payload,
            "context": request.context,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Route to appropriate model
        selected_model = await router.route(request.instruction, request.payload)

        # Execute AI model
        result = await engine.execute(
            model_name=selected_model,
            instruction=request.instruction,
            payload=request.payload,
            context=session_context.get("context", {})
        )

        # Update session context
        session_context["messages"].append({
            "instruction": request.instruction,
            "model_used": selected_model,
            "timestamp": datetime.utcnow().isoformat()
        })
        session_context["context"].update(request.context or {})

        await synchronizer.update_context(session_id, session_context)

        # Log routing decision
        await db.save_routing_log({
            "session_id": session_id,
            "instruction": request.instruction,
            "model_selected": selected_model,
            "timestamp": datetime.utcnow().isoformat()
        })

        return {
            "session_id": session_id,
            "model_used": selected_model,
            "result": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for streaming responses"""
    await websocket.accept()

    try:
        while True:
            # Receive MCP request
            data = await websocket.receive_text()
            request_data = json.loads(data)

            instruction = request_data.get("instruction", "")
            payload = request_data.get("payload", {})
            context = request_data.get("context", {})

            # Get session context
            session_context = await synchronizer.get_context(session_id)
            if session_context is None:
                session_context = {
                    "session_id": session_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "messages": [],
                    "context": context
                }

            # Route to appropriate model
            selected_model = await router.route(instruction, payload)

            # Send model selection
            await websocket.send_json({
                "type": "model_selected",
                "model": selected_model
            })

            # Stream response
            async for chunk in engine.execute_stream(
                model_name=selected_model,
                instruction=instruction,
                payload=payload,
                context=session_context.get("context", {})
            ):
                await websocket.send_json({
                    "type": "partial",
                    "data": chunk
                })

            # Send final response
            await websocket.send_json({
                "type": "final",
                "model_used": selected_model,
                "session_id": session_id
            })

            # Update session context
            session_context["messages"].append({
                "instruction": instruction,
                "model_used": selected_model,
                "timestamp": datetime.utcnow().isoformat()
            })
            await synchronizer.update_context(session_id, session_context)

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for session: {session_id}")
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e)
        })

@app.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session context"""
    context = await synchronizer.get_context(session_id)
    if context is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return context

@app.get("/logs")
async def get_logs(limit: int = 50):
    """Get recent routing logs"""
    logs = await db.get_routing_logs(limit)
    return {"logs": logs}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
=======
router = AdaptiveRouter()
engine = IntegrationEngine(router)

class MCPRequest(BaseModel):
    session_id: str | None = None
    instruction: str
    context: dict | None = {}
    payload: dict | None = {}

@app.post("/mcp/request")
async def mcp_request(req: MCPRequest):
    if not req.session_id:
        req.session_id = str(uuid.uuid4())
    result = await engine.handle_request(req.dict())
    return {"session_id": req.session_id, "result": result}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            import json
            req = json.loads(data)
            req["session_id"] = session_id
            result = await engine.handle_request(req, stream=True, websocket=websocket)
            if result is not None:
                await websocket.send_text(json.dumps({"final": result}))
    except WebSocketDisconnect:
        print("WebSocket disconnected", session_id)
>>>>>>> 6e09a957910bc46f66c1f75e1797b0984e2dd192
