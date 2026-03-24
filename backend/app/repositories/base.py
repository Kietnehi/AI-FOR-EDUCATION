from bson import ObjectId


def serialize_document(document: dict | None) -> dict | None:
    if document is None:
        return None
    serialized = {}
    for key, value in document.items():
        if isinstance(value, ObjectId):
            serialized["id" if key == "_id" else key] = str(value)
        else:
            serialized[key] = value
    return serialized
