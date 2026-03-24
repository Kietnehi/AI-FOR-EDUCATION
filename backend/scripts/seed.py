import asyncio

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.utils.time import utc_now


async def main() -> None:
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]

    user = {
        "name": "Demo User",
        "email": "demo@example.com",
        "role": "teacher",
        "status": "active",
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    existing = await db.users.find_one({"email": user["email"]})
    if not existing:
        await db.users.insert_one(user)
        print("Inserted demo user")
    else:
        print("Demo user already exists")

    material = {
        "user_id": "demo-user",
        "title": "Mau hoc lieu Sinh hoc",
        "description": "Tai lieu mau de test luong MVP",
        "subject": "Biology",
        "education_level": "High School",
        "source_type": "manual_text",
        "file_name": None,
        "file_url": None,
        "raw_text": "DNA la vat chat di truyen...",
        "cleaned_text": "DNA la vat chat di truyen...",
        "tags": ["biology", "genetics"],
        "processing_status": "uploaded",
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    if await db.learning_materials.count_documents({}) == 0:
        await db.learning_materials.insert_one(material)
        print("Inserted sample material")
    else:
        print("Materials collection already has data")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
