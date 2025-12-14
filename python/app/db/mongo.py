"""
MongoDB Database Manager
"""
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Dict, Any, List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

class MongoDB:
    def __init__(self):
        self.client = None
        self.db = None
        self.sessions = None
        self.requests = None
        self.routing_logs = None

    async def connect(self):
        """Connect to MongoDB"""
        mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

        try:
            self.client = AsyncIOMotorClient(mongodb_uri)
            self.db = self.client.adaptive_mcp
            self.sessions = self.db.sessions
            self.requests = self.db.requests
            self.routing_logs = self.db.routing_logs

            await self.client.admin.command("ping")
            print("✅ Connected to MongoDB successfully")

        except Exception as e:
            print(f"⚠️ MongoDB connection failed: {e}")
            print(" Running in-memory mode (data will not persist)")
            self._setup_memory_store()

    def _setup_memory_store(self):
        """Setup in-memory storage as fallback"""
        self.sessions = None
        self.requests = None
        self.routing_logs = None

        self._memory_sessions = {}
        self._memory_requests = []
        self._memory_logs = []

    async def disconnect(self):
        if self.client:
            self.client.close()

    async def get_session_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session context"""
        if self.sessions is not None:
            return await self.sessions.find_one({"session_id": session_id})
        return self._memory_sessions.get(session_id)

    async def update_session_context(self, session_id: str, context: Dict[str, Any]) -> bool:
        """Update session context"""
        if self.sessions is not None:
            result = await self.sessions.update_one(
                {"session_id": session_id},
                {"$set": context},
                upsert=True
            )
            return result.acknowledged

        self._memory_sessions[session_id] = context
        return True

    async def delete_session_context(self, session_id: str) -> bool:
        """Delete session context"""
        if self.sessions is not None:
            result = await self.sessions.delete_one({"session_id": session_id})
            return result.deleted_count > 0

        return self._memory_sessions.pop(session_id, None) is not None

    async def save_request(self, request_data: Dict[str, Any]) -> bool:
        """Save request to database"""
        if self.requests is not None:
            result = await self.requests.insert_one(request_data)
            return result.acknowledged

        self._memory_requests.append(request_data)
        return True

    async def save_routing_log(self, log_data: Dict[str, Any]) -> bool:
        """Save routing log"""
        if self.routing_logs is not None:
            result = await self.routing_logs.insert_one(log_data)
            return result.acknowledged

        self._memory_logs.append(log_data)
        return True

    async def get_routing_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent routing logs"""
        if self.routing_logs is not None:
            cursor = self.routing_logs.find().sort("timestamp", -1).limit(limit)
            logs = await cursor.to_list(length=limit)
            for log in logs:
                log.pop("_id", None)
            return logs

        return self._memory_logs[-limit:]
