from fastapi import APIRouter

from app.api.routes import (
    auth,
    chat,
    contact,
    converter,
    files,
    games,
    generated_contents,
    materials,
    personalization,
    web_search,
)

api_router = APIRouter()
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(contact.router, tags=["contact"])

api_router.include_router(materials.router, tags=["materials"])
api_router.include_router(generated_contents.router, tags=["generated-contents"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(games.router, tags=["games"])
api_router.include_router(personalization.router, tags=["personalization"])
api_router.include_router(files.router, tags=["files"])
api_router.include_router(converter.router, tags=["converter"], prefix="/converter")
api_router.include_router(web_search.router, tags=["web-search"], prefix="/web-search")
