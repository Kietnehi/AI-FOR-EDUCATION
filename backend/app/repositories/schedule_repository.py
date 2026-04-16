from __future__ import annotations
from bson import ObjectId
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base import serialize_document
from app.utils.time import vietnam_now, parse_vietnam_datetime

class ScheduleRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.collection = db.schedules

    async def get_for_user(self, user_id: str) -> dict | None:
        doc = await self.collection.find_one({"user_id": user_id})
        if not doc:
            return None
            
        # Clean up corrupted data on the fly
        if "events" in doc and isinstance(doc["events"], list):
            doc["events"] = [
                e for e in doc["events"] 
                if isinstance(e, dict) and e.get("title") and e.get("start_time")
            ]
            
        return serialize_document(doc)

    async def create_or_update(self, user_id: str, events: list[dict]) -> dict:
        now = datetime.utcnow()
        existing = await self.get_for_user(user_id)
        
        if existing:
            schedule_id = ObjectId(existing["id"])
            await self.collection.update_one(
                {"_id": schedule_id},
                {"$set": {"events": events, "updated_at": now}}
            )
            return await self.get_for_user(user_id)
        else:
            payload = {
                "user_id": user_id,
                "events": events,
                "created_at": now,
                "updated_at": now
            }
            result = await self.collection.insert_one(payload)
            return serialize_document({"_id": result.inserted_id, **payload})

    async def get_due_events(self) -> list[dict]:
        """Find users with events that are starting soon (next 10-12 mins) or already passed but not yet notified."""
        now = vietnam_now()
        cursor = self.collection.find({"events.notified": {"$ne": True}})
        due_schedules: list[dict] = []

        async for doc in cursor:
            serialized = serialize_document(doc)
            if not serialized:
                continue

            events = serialized.get("events", [])
            has_due_event = False
            for event in events:
                if not isinstance(event, dict) or event.get("notified"):
                    continue

                start_time = event.get("start_time")
                if not start_time:
                    continue

                try:
                    event_dt = parse_vietnam_datetime(start_time)
                except ValueError:
                    continue

                # Notify if event starts in the next 12 minutes
                # or started in the last 5 minutes (to account for task jitter)
                diff_minutes = (event_dt - now).total_seconds() / 60
                if -5 <= diff_minutes <= 12:
                    has_due_event = True
                    break

            if has_due_event:
                due_schedules.append(serialized)

        return due_schedules

    async def mark_event_notified(self, user_id: str, title: str, start_time: str) -> None:
        """Mark a specific event as notified using its unique title and time combination."""
        await self.collection.update_one(
            {
                "user_id": user_id,
                "events": {
                    "$elemMatch": {
                        "title": title,
                        "start_time": start_time
                    }
                }
            },
            {"$set": {"events.$.notified": True}}
        )
