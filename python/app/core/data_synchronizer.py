"""
Data Synchronizer - Manages session context and data persistence
"""
from typing import Dict, Any, Optional


class DataSynchronizer:
    def __init__(self, db):
        self.db = db

    async def get_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session context from database"""
        return await self.db.get_session_context(session_id)

    async def update_context(self, session_id: str, context: Dict[str, Any]) -> bool:
        """Update session context in database"""
        return await self.db.update_session_context(session_id, context)

    async def delete_context(self, session_id: str) -> bool:
        """Delete session context"""
        return await self.db.delete_session_context(session_id)
