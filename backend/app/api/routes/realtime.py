import asyncio
import json
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_current_user, get_database
from app.schemas.auth import AuthUser
from app.services.generation_service import GenerationService
from app.services.material_service import MaterialService
from app.services.storage import storage_service

router = APIRouter(prefix="/realtime", tags=["realtime"])

_POLL_INTERVAL_SECONDS = 2


def _encode_sse(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


def _signature_for(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return sha256(raw.encode("utf-8")).hexdigest()


@router.get("/materials/stream")
async def stream_material_updates(
    request: Request,
    material_id: str | None = None,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> StreamingResponse:
    material_service = MaterialService(db)
    generation_service = GenerationService(db)

    async def event_generator():
        last_signature: str | None = None

        yield "retry: 2000\n\n"

        while True:
            if await request.is_disconnected():
                break

            if material_id:
                try:
                    material = await material_service.get_material(material_id, user_id=user.id)
                    generated_contents = await generation_service.list_generated_contents(
                        material_id,
                        user_id=user.id,
                    )
                    if not material.get("storage_type"):
                        material["storage_type"] = storage_service.detect_storage_type(
                            material.get("file_url")
                        )
                    for item in generated_contents:
                        if not item.get("storage_type"):
                            item["storage_type"] = storage_service.detect_storage_type(
                                item.get("file_url")
                            )
                    payload = {
                        "scope": "material_detail",
                        "material_id": material_id,
                        "deleted": False,
                        "material": material,
                        "generated_contents": generated_contents,
                    }
                except HTTPException as exc:
                    if exc.status_code != 404:
                        raise
                    payload = {
                        "scope": "material_detail",
                        "material_id": material_id,
                        "deleted": True,
                        "material": None,
                        "generated_contents": [],
                    }
            else:
                items, total = await material_service.list_materials(
                    user_id=user.id,
                    skip=0,
                    limit=100,
                )
                for item in items:
                    if not item.get("storage_type"):
                        item["storage_type"] = storage_service.detect_storage_type(
                            item.get("file_url")
                        )
                payload = {
                    "scope": "materials",
                    "items": items,
                    "total": total,
                }

            signature = _signature_for(payload)
            if signature != last_signature:
                yield _encode_sse("snapshot", payload)
                last_signature = signature
            else:
                yield ": keep-alive\n\n"

            await asyncio.sleep(_POLL_INTERVAL_SECONDS)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
