from bson import ObjectId
from fastapi import HTTPException


def parse_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid ObjectId: {value}")
    return ObjectId(value)


def object_id_str(value: ObjectId | str) -> str:
    return str(value)
