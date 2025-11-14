"""WebSocket connection manager for real-time updates"""
from typing import List, Dict, Any
from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for broadcasting messages"""
    
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and track a new WebSocket connection"""
        await websocket.accept()
        self.active.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection"""
        if websocket in self.active:
            self.active.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Broadcast a message to all active connections"""
        living: List[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_json(message)
                living.append(ws)
            except Exception:
                # Drop broken connection
                pass
        self.active = living


# Global manager instance
manager = ConnectionManager()

