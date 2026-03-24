import chromadb

from app.core.config import settings

_chroma_client: chromadb.PersistentClient | None = None


def get_chroma_client() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return _chroma_client


def get_chroma_collection() -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(name=settings.chroma_collection_name)
