from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import Citation


class CreateChatSessionRequest(BaseModel):
    session_title: str | None = None


class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    material_id: str
    session_title: str
    created_at: datetime
    updated_at: datetime


class ChatMessageRequest(BaseModel):
    message: str
    images: list[str] = Field(default_factory=list, description="Base64 encoded images")


class MascotChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    images: list[str] = Field(default_factory=list, description="Base64 encoded images")
    use_web_search: bool = Field(
        default=False,
        description="Bật tìm kiếm web cho tin nhắn mascot",
    )
    use_google: bool = Field(
        default=True,
        description="Nếu bật web search, thử Google trước",
    )


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    message: str
    citations: list[Citation] = Field(default_factory=list)
    created_at: datetime
    images: list[str] = Field(default_factory=list)
    model_used: str | None = Field(
        default=None, description="Model đã sử dụng để tạo response"
    )
    fallback_applied: bool = Field(
        default=False, description="Có phải fallback từ model khác không"
    )
    search_results: dict | None = Field(
        default=None, description="Kết quả tìm kiếm web nếu có"
    )
    is_web_search: bool = Field(
        default=False, description="Liệu tin nhắn này có sử dụng tìm kiếm web hay không"
    )


class ChatSessionDetailResponse(BaseModel):
    session: ChatSessionResponse
    messages: list[ChatMessageResponse]


class ChatSessionListResponse(BaseModel):
    sessions: list[ChatSessionResponse]


class DeleteChatSessionsResponse(BaseModel):
    deleted_count: int


class TranscriptionResponse(BaseModel):
    text: str


class TextToSpeechRequest(BaseModel):
    text: str
    lang: str = "vi"


class MascotChatResponse(BaseModel):
    message: str
    model: str
    session_id: str
    model_used: str | None = None
    fallback_applied: bool = False
    is_web_search: bool = False
    search_provider: str | None = None


class MascotChatSessionResponse(BaseModel):
    id: str
    user_id: str
    session_title: str
    created_at: datetime
    updated_at: datetime


class MascotMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    message: str
    created_at: datetime
    images: list[str] = Field(default_factory=list)
    model_used: str | None = None
    fallback_applied: bool = False
    is_web_search: bool = False
    search_provider: str | None = None
    search_results: dict | None = None


class MascotChatSessionDetailResponse(BaseModel):
    session: MascotChatSessionResponse
    messages: list[MascotMessageResponse]


class MascotChatSessionListResponse(BaseModel):
    sessions: list[MascotChatSessionResponse]


class WebSearchSource(BaseModel):
    """Thông tin nguồn từ tìm kiếm web"""

    index: int
    title: str
    uri: str
    snippet: str


class WebSearchCitation(BaseModel):
    """Siêu dữ liệu trích dẫn từ tìm kiếm web"""

    index: int
    title: str
    url: str
    source: str = Field(description="google_search hoặc tavily")


class WebSearchRequest(BaseModel):
    """Yêu cầu tìm kiếm web với sinh tạo câu trả lời"""

    query: str = Field(description="Câu hỏi tìm kiếm")
    use_google: bool = Field(
        default=True, description="Thử Tìm kiếm Google trước (yêu cầu mô hình Gemini)"
    )


class WebSearchResponse(BaseModel):
    """Phản hồi với kết quả tìm kiếm và câu trả lời được định dạng"""

    answer: str = Field(description="Văn bản câu trả lời với trích dẫn nội tuyến")
    raw_text: str = Field(description="Câu trả lời thô mà không có định dạng")
    sources: list[WebSearchSource] = Field(
        description="Danh sách các nguồn từ tìm kiếm"
    )
    citations: list[WebSearchCitation] = Field(
        description="Siêu dữ liệu trích dẫn cho các nguồn"
    )
    search_provider: str = Field(
        description="Nhà cung cấp được sử dụng: google_search hoặc tavily"
    )
    model: str = Field(description="Mô hình được sử dụng để sinh tạo")
    search_queries: list[str] = Field(
        default_factory=list, description="Các câu hỏi tìm kiếm được sử dụng"
    )


class SessionWebSearchRequest(WebSearchRequest):
    """Yêu cầu tìm kiếm web cho một phiên chatbot"""

    session_id: str = Field(description="ID phiên chat")


class ChatMessageWithSearchResponse(ChatMessageResponse):
    """Phản hồi tin nhắn chat với kết quả tìm kiếm tùy chọn"""
