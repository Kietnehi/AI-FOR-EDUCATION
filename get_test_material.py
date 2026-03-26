import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.core.config import settings

async def get_materials():
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]
    materials = await db.learning_materials.find_one()
    if materials:
        print(f"Material ID: {materials.get('_id')}")
        print(f"Title: {materials.get('title')}")
        print(f"Processing Status: {materials.get('processing_status')}")
    client.close()

asyncio.run(get_materials())
