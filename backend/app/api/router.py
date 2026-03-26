from fastapi import APIRouter

from app.api.routes import chat, files, games, generated_contents, materials, converter

api_router = APIRouter()
api_router.include_router(materials.router, tags=["materials"])
api_router.include_router(generated_contents.router, tags=["generated-contents"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(games.router, tags=["games"])
api_router.include_router(files.router, tags=["files"])
api_router.include_router(converter.router, tags=["converter"], prefix="/converter")
