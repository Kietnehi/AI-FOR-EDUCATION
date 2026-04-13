from app.ai.generation.llm_client import LLMClient


# Predefined color palette for concept categories
CATEGORY_COLORS: dict[str, str] = {
    "main": "#6366f1",       # Indigo – core/central concepts
    "concept": "#8b5cf6",    # Violet – sub-concepts
    "process": "#06b6d4",    # Cyan – processes/steps
    "example": "#10b981",    # Emerald – examples/case studies
    "definition": "#f59e0b", # Amber – definitions/terms
    "principle": "#ef4444",  # Red – rules/principles
    "application": "#ec4899",# Pink – applications/use-cases
    "other": "#64748b",      # Slate – fallback
}


class KnowledgeGraphGenerator:
    """
    Generates structured knowledge graph data (nodes + edges) from document text
    using an LLM. The output is suitable for 3-D visualization with Three.js.
    """

    def __init__(self) -> None:
        self.llm = LLMClient()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(self, text: str, title: str = "Knowledge Graph") -> dict:
        """
        Analyse *text* and return a knowledge-graph payload with the shape:
        {
            "title": str,
            "nodes": [ { "id", "label", "category", "description", "size", "color" } ],
            "edges": [ { "id", "source", "target", "label", "weight" } ],
            "metadata": { "total_nodes", "total_edges", "categories" }
        }
        """
        raw = self.llm.json_response(
            system_prompt=self._system_prompt(),
            user_prompt=self._user_prompt(text, title),
            fallback=self._fallback(title),
        )

        graph = self._validate_and_enrich(raw, title)
        return graph

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    @staticmethod
    def _system_prompt() -> str:
        return (
            "Bạn là chuyên gia phân tích kiến thức và tạo knowledge graph cho giáo dục. "
            "Nhiệm vụ: phân tích tài liệu và trích xuất CÁC KHÁI NIỆM QUAN TRỌNG cùng MỐI LIÊN HỆ giữa chúng. "
            "Yêu cầu:\n"
            "- Xác định 10-20 khái niệm/chủ đề chính từ tài liệu.\n"
            "- Mỗi khái niệm có loại (category): main|concept|process|example|definition|principle|application|other.\n"
            "- Xác định 15-30 mối liên hệ có nghĩa giữa các khái niệm.\n"
            "- Dùng tiếng Việt có dấu chuẩn xác cho label và description.\n"
            "- Trả về JSON hợp lệ KHÔNG có markdown, không có text thừa.\n"
            "- ID phải là chuỗi ngắn không dấu không khoảng trắng, ví dụ: 'n1', 'n2', 'edge_1'."
        )

    @staticmethod
    def _user_prompt(text: str, title: str) -> str:
        schema = (
            "{\n"
            '  "title": "' + title + '",\n'
            '  "nodes": [\n'
            '    {\n'
            '      "id": "n1",\n'
            '      "label": "Tên khái niệm ngắn",\n'
            '      "category": "main",\n'
            '      "description": "Mô tả ngắn 1-2 câu về khái niệm này trong ngữ cảnh tài liệu.",\n'
            '      "size": 1.5\n'
            "    }\n"
            "  ],\n"
            '  "edges": [\n'
            '    {\n'
            '      "id": "e1",\n'
            '      "source": "n1",\n'
            '      "target": "n2",\n'
            '      "label": "Nhãn ngắn gọn mô tả mối quan hệ",\n'
            '      "weight": 1.0\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
        )
        return (
            f"Tạo knowledge graph từ tài liệu dưới đây.\n"
            f"Tiêu đề tài liệu: {title}\n\n"
            f"Schema JSON cần trả về:\n{schema}"
            f"Tài liệu:\n{text[:10000]}"
        )

    # ------------------------------------------------------------------
    # Validation & enrichment
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_and_enrich(raw: dict, title: str) -> dict:
        nodes: list[dict] = []
        valid_ids: set[str] = set()

        raw_nodes = raw.get("nodes") if isinstance(raw, dict) else []
        if not isinstance(raw_nodes, list):
            raw_nodes = []

        for idx, node in enumerate(raw_nodes):
            if not isinstance(node, dict):
                continue
            node_id = str(node.get("id") or f"n{idx + 1}")
            label = str(node.get("label") or f"Khái niệm {idx + 1}")
            category = str(node.get("category") or "other")
            if category not in CATEGORY_COLORS:
                category = "other"
            description = str(node.get("description") or "")

            # size: main nodes bigger, others medium
            try:
                size = float(node.get("size") or 1.0)
            except (TypeError, ValueError):
                size = 1.0

            # Clamp size
            size = max(0.5, min(size, 3.0))

            color = CATEGORY_COLORS[category]

            nodes.append(
                {
                    "id": node_id,
                    "label": label,
                    "category": category,
                    "description": description,
                    "size": size,
                    "color": color,
                }
            )
            valid_ids.add(node_id)

        edges: list[dict] = []
        raw_edges = raw.get("edges") if isinstance(raw, dict) else []
        if not isinstance(raw_edges, list):
            raw_edges = []

        for idx, edge in enumerate(raw_edges):
            if not isinstance(edge, dict):
                continue
            source = str(edge.get("source") or "")
            target = str(edge.get("target") or "")
            # Skip edges referencing non-existent nodes
            if source not in valid_ids or target not in valid_ids:
                continue
            edge_id = str(edge.get("id") or f"e{idx + 1}")
            label = str(edge.get("label") or "liên quan đến")
            try:
                weight = float(edge.get("weight") or 1.0)
            except (TypeError, ValueError):
                weight = 1.0
            weight = max(0.1, min(weight, 3.0))

            edges.append(
                {
                    "id": edge_id,
                    "source": source,
                    "target": target,
                    "label": label,
                    "weight": weight,
                }
            )

        used_categories = list({n["category"] for n in nodes})

        return {
            "title": raw.get("title") or title if isinstance(raw, dict) else title,
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "categories": used_categories,
                "category_colors": {cat: CATEGORY_COLORS[cat] for cat in used_categories},
            },
        }

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback(title: str) -> dict:
        return {
            "title": title,
            "nodes": [
                {
                    "id": "n1",
                    "label": title,
                    "category": "main",
                    "description": "Chủ đề chính của tài liệu.",
                    "size": 2.0,
                    "color": CATEGORY_COLORS["main"],
                },
                {
                    "id": "n2",
                    "label": "Khái niệm cốt lõi",
                    "category": "concept",
                    "description": "Các khái niệm chính trong tài liệu.",
                    "size": 1.0,
                    "color": CATEGORY_COLORS["concept"],
                },
            ],
            "edges": [
                {
                    "id": "e1",
                    "source": "n1",
                    "target": "n2",
                    "label": "bao gồm",
                    "weight": 1.0,
                }
            ],
            "metadata": {
                "total_nodes": 2,
                "total_edges": 1,
                "categories": ["main", "concept"],
                "category_colors": {
                    "main": CATEGORY_COLORS["main"],
                    "concept": CATEGORY_COLORS["concept"],
                },
            },
        }
