from app.api.routes import web_search


class _FakeDDGS:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def text(self, query: str, max_results: int):
        return [{"title": query, "max_results": max_results}]


class _FailingImageDDGS(_FakeDDGS):
    def images(self, query: str, max_results: int):
        raise RuntimeError("duckduckgo connect failed")


def test_get_ddgs_class_returns_resolved_class() -> None:
    assert web_search._get_ddgs_class() is web_search.DDGS


def test_run_ddgs_search_uses_resolved_ddgs_class(monkeypatch) -> None:
    monkeypatch.setattr(web_search, "_get_ddgs_class", lambda: _FakeDDGS)

    results = web_search._run_ddgs_search("VIETNAM", "text", 10)

    assert results == [{"title": "VIETNAM", "max_results": 10}]


def test_run_ddgs_search_falls_back_to_wikimedia_for_images(monkeypatch) -> None:
    monkeypatch.setattr(web_search, "_get_ddgs_class", lambda: _FailingImageDDGS)
    monkeypatch.setattr(
        web_search,
        "_search_wikimedia_images",
        lambda query, max_results: [{"title": query, "source": "Wikimedia Commons", "max_results": max_results}],
    )

    results = web_search._run_ddgs_search("Vietnam", "images", 5)

    assert results == [{"title": "Vietnam", "source": "Wikimedia Commons", "max_results": 5}]


def test_looks_like_network_error_detects_socket_failures() -> None:
    assert web_search._looks_like_network_error(
        RuntimeError("tcp connect error: forbidden by its access permissions")
    )
    assert not web_search._looks_like_network_error(RuntimeError("unexpected parsing issue"))
