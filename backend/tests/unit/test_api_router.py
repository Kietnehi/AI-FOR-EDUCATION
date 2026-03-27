from app.api.router import api_router


def test_api_router_registers_expected_route_groups() -> None:
    paths = {route.path for route in api_router.routes}

    assert "/materials" in paths
    assert "/generated-contents/{content_id}" in paths
    assert "/chat/{material_id}/session" in paths
    assert "/games/{generated_content_id}/submit" in paths
    assert "/files/{file_path:path}/download" in paths
    assert "/converter/convert-url" in paths


def test_api_router_exposes_expected_tags() -> None:
    tags_by_path = {route.path: route.tags for route in api_router.routes}

    assert tags_by_path["/materials"] == ["materials"]
    assert tags_by_path["/generated-contents/{content_id}"] == ["generated-contents"]
    assert tags_by_path["/chat/{material_id}/session"] == ["chat"]
    assert tags_by_path["/games/{generated_content_id}/submit"] == ["games"]
    assert tags_by_path["/files/{file_path:path}/download"] == ["files"]
    assert tags_by_path["/converter/convert-url"] == ["converter"]
