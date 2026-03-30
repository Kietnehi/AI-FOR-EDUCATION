from app.api.routes import web_search


class _FakeDDGS:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def text(self, query: str, max_results: int):
        return [{"title": query, "max_results": max_results}]


def test_get_ddgs_class_returns_resolved_class() -> None:
    assert web_search._get_ddgs_class() is web_search.DDGS


def test_run_ddgs_search_uses_resolved_ddgs_class(monkeypatch) -> None:
    monkeypatch.setattr(web_search, "_get_ddgs_class", lambda: _FakeDDGS)

    results = web_search._run_ddgs_search("VIETNAM", "text", 10)

    assert results == [{"title": "VIETNAM", "max_results": 10}]
