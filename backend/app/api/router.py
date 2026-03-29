from fastapi import APIRouter

from app.api.routes import chat, files, games, generated_contents, materials, converter, web_search

api_router = APIRouter()
api_router.include_router(materials.router, tags=["materials"])
api_router.include_router(generated_contents.router, tags=["generated-contents"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(games.router, tags=["games"])
api_router.include_router(files.router, tags=["files"])
api_router.include_router(converter.router, tags=["converter"], prefix="/converter")
api_router.include_router(web_search.router, tags=["web-search"], prefix="/web-search")
