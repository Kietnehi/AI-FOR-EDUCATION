from app.ai.ingestion.text_cleaner import TextCleaner


def test_clean_normalizes_line_breaks_and_spaces() -> None:
    raw_text = "  Dong 1\r\n\r\n\r\nDong\t\t2  \n\n\nDong 3  "

    cleaned = TextCleaner.clean(raw_text)

    assert cleaned == "Dong 1\n\nDong 2 \n\nDong 3"


def test_clean_returns_empty_string_when_text_is_blank() -> None:
    assert TextCleaner.clean("   \n\n\t  ") == ""
