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

# ---------------------------------------------------
# Initialize App
# ---------------------------------------------------
app = FastAPI(title="Adaptive MCP-AI System")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------
# Initialize Components
# ---------------------------------------------------
db = MongoDB()
router = AdaptiveRouter(db)
engine = IntegrationEngine(db)
synchronizer = DataSynchronizer(db)


class MCPRequest(BaseModel):
    session_id: Optional[str] = None
    instruction: str
    context: Optional[Dict[str, Any]] = {}
    payload: Optional[Dict[str, Any]] = {}


# ---------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------
@app.on_event("startup")
async def startup_event():
    await db.connect()


@app.on_event("shutdown")
async def shutdown_event():
    await db.disconnect()


# ---------------------------------------------------
# Root
# ---------------------------------------------------
@app.get("/")
async def root():
    return {
        "message": "Adaptive MCP-AI System API",
        "version": "1.0.0",
        "endpoints": {
            "mcp_request": "/mcp/request",
            "websocket": "/ws/{session_id}",
            "session_context": "/session/{session_id}",
            "routing_logs": "/logs",
        },
    }


# ---------------------------------------------------
# MCP Request Handler
# ---------------------------------------------------
@app.post("/mcp/request")
async def mcp_request(request: MCPRequest):
    try:
        session_id = request.session_id or str(uuid.uuid4())

        # Load / create session context
        session_context = await synchronizer.get_context(session_id)
        if session_context is None:
            session_context = {
                "session_id": session_id,
                "created_at": datetime.utcnow().isoformat(),
                "messages": [],
                "context": request.context or {},
            }

        # Save request log
        await db.save_request({
            "session_id": session_id,
            "instruction": request.instruction,
            "payload": request.payload,
            "context": request.context,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Route instruction
        selected_model = await router.route(request.instruction, request.payload)

        # Execute model
        result = await engine.execute(
            model_name=selected_model,
            instruction=request.instruction,
            payload=request.payload,
            context=session_context.get("context", {}),
        )

        # Update session context
        session_context["messages"].append({
            "instruction": request.instruction,
            "model_used": selected_model,
            "timestamp": datetime.utcnow().isoformat(),
        })
        session_context["context"].update(request.context or {})

        await synchronizer.update_context(session_id, session_context)

        # Routing log
        await db.save_routing_log({
            "session_id": session_id,
            "instruction": request.instruction,
            "model_selected": selected_model,
            "timestamp": datetime.utcnow().isoformat(),
        })

        return {
            "session_id": session_id,
            "model_used": selected_model,
            "result": result,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            request_data = json.loads(data)

            instruction = request_data.get("instruction", "")
            payload = request_data.get("payload", {})
            context = request_data.get("context", {})

            # Load or create context
            session_context = await synchronizer.get_context(session_id)
            if session_context is None:
                session_context = {
                    "session_id": session_id,
                    "created_at": datetime.utcnow().isoformat(),
                    "messages": [],
                    "context": context,
                }

            # Route instruction
            model_name = await router.route(instruction, payload)

            # Send model selection
            await websocket.send_json({
                "type": "model_selected",
                "model": model_name,
            })

            # Stream response
            async for chunk in engine.execute_stream(
                model_name=model_name,
                instruction=instruction,
                payload=payload,
                context=session_context.get("context", {}),
            ):
                await websocket.send_json({
                    "type": "partial",
                    "data": chunk,
                })

            # Final response
            await websocket.send_json({
                "type": "final",
                "model_used": model_name,
                "session_id": session_id,
            })

            # Log session update
            session_context["messages"].append({
                "instruction": instruction,
                "model_used": model_name,
                "timestamp": datetime.utcnow().isoformat(),
            })
            await synchronizer.update_context(session_id, session_context)

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {session_id}")

    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "error": str(e),
        })


# ---------------------------------------------------
# Get Session
# ---------------------------------------------------
@app.get("/session/{session_id}")
async def get_session(session_id: str):
    context = await synchronizer.get_context(session_id)
    if context is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return context


# ---------------------------------------------------
# Logs
# ---------------------------------------------------
@app.get("/logs")
async def get_logs(limit: int = 50):
    logs = await db.get_routing_logs(limit)
    return {"logs": logs}


# ---------------------------------------------------
# Health Check
# ---------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
