from app.db.chroma import get_chroma_collection


class ChromaVectorStore:
    def __init__(self) -> None:
        self.collection = get_chroma_collection()

    def upsert_chunks(
        self,
        material_id: str,
        chunk_ids: list[str],
        texts: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> None:
        self.collection.upsert(ids=chunk_ids, documents=texts, embeddings=embeddings, metadatas=metadatas)

    def delete_material_chunks(self, material_id: str) -> None:
        self.collection.delete(where={"material_id": material_id})

    def query(self, embedding: list[float], material_id: str | list[str], n_results: int = 5) -> dict:
        where_clause = {}
        if isinstance(material_id, list):
            where_clause = {"material_id": {"$in": material_id}}
        else:
            where_clause = {"material_id": material_id}
            
        return self.collection.query(
            query_embeddings=[embedding],
            n_results=n_results,
            where=where_clause,
        )
