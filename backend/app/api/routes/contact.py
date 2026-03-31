from fastapi import APIRouter, HTTPException, status

from app.schemas.contact import CooperationContactRequest, CooperationContactResponse
from app.services.contact_service import ContactDeliveryError, send_cooperation_contact_email
from app.services.turnstile_service import TurnstileVerificationError, verify_turnstile_token

router = APIRouter(prefix="/contact")


@router.post("/cooperation", response_model=CooperationContactResponse)
async def submit_cooperation_contact(
    payload: CooperationContactRequest,
) -> CooperationContactResponse:
    try:
        await verify_turnstile_token(payload.captcha_token)
    except TurnstileVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    try:
        await send_cooperation_contact_email(payload)
    except ContactDeliveryError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    return CooperationContactResponse(message="Đã gửi liên hệ hợp tác thành công.")
