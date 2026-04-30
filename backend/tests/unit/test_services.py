"""Unit tests for service layer functions."""

import asyncio
import pytest
from unittest.mock import MagicMock, patch


class TestCacheService:
    def _mock_redis(self, mocker):
        """Create a mock redis client and patch _get_redis."""
        mock_client = MagicMock()
        mocker.patch("app.services.cache._get_redis", return_value=mock_client)
        return mock_client

    def test_get_cached_notion_page_hit(self, mocker):
        mock_redis = self._mock_redis(mocker)
        mock_redis.get.return_value = '{"blocks": [{"type": "paragraph"}]}'

        from app.services.cache import get_cached_notion_page
        result = get_cached_notion_page("page_123")
        assert result == {"blocks": [{"type": "paragraph"}]}
        mock_redis.get.assert_called_once_with("notion:page:page_123")

    def test_get_cached_notion_page_miss(self, mocker):
        mock_redis = self._mock_redis(mocker)
        mock_redis.get.return_value = None

        from app.services.cache import get_cached_notion_page
        result = get_cached_notion_page("page_123")
        assert result is None

    def test_set_cached_notion_page(self, mocker):
        mock_redis = self._mock_redis(mocker)

        from app.services.cache import set_cached_notion_page
        set_cached_notion_page("page_123", {"blocks": []}, expire_seconds=300)
        mock_redis.setex.assert_called_once()

    def test_invalidate_notion_page(self, mocker):
        mock_redis = self._mock_redis(mocker)

        from app.services.cache import invalidate_notion_page
        invalidate_notion_page("page_123")
        mock_redis.delete.assert_called_once_with("notion:page:page_123")


class TestNotionBlocksToMarkdown:
    def test_paragraph(self):
        from app.services.notion_fetch import notion_blocks_to_markdown
        blocks = [{"type": "paragraph", "paragraph": {"rich_text": [{"plain_text": "Hello world"}]}}]
        result = notion_blocks_to_markdown(blocks)
        assert "Hello world" in result

    def test_heading(self):
        from app.services.notion_fetch import notion_blocks_to_markdown
        blocks = [{"type": "heading_1", "heading_1": {"rich_text": [{"plain_text": "Title"}]}}]
        result = notion_blocks_to_markdown(blocks)
        assert "# Title" in result

    def test_bulleted_list(self):
        from app.services.notion_fetch import notion_blocks_to_markdown
        blocks = [{"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": [{"plain_text": "Item 1"}]}}]
        result = notion_blocks_to_markdown(blocks)
        assert "- Item 1" in result

    def test_empty_blocks(self):
        from app.services.notion_fetch import notion_blocks_to_markdown
        result = notion_blocks_to_markdown([])
        assert result == ""

    def test_code_block(self):
        from app.services.notion_fetch import notion_blocks_to_markdown
        blocks = [{"type": "code", "code": {"rich_text": [{"plain_text": "print('hello')"}], "language": "python"}}]
        result = notion_blocks_to_markdown(blocks)
        assert "```python" in result
        assert "print('hello')" in result

    def test_equation_block(self):
        from app.services.notion_fetch import notion_blocks_to_markdown
        blocks = [{"type": "equation", "equation": {"expression": "E = mc^2"}}]
        result = notion_blocks_to_markdown(blocks)
        assert "$$ E = mc^2 $$" in result


class TestOpenAIService:
    @pytest.mark.asyncio
    async def test_analyze_symbols_no_client(self, mocker):
        mocker.patch("app.services.openai_service.openai_client", None)
        from app.services.openai_service import analyze_symbols
        result = await analyze_symbols("some markdown")
        assert result == []

    @pytest.mark.asyncio
    async def test_analyze_structure_no_client(self, mocker):
        mocker.patch("app.services.openai_service.openai_client", None)
        from app.services.openai_service import analyze_structure
        result = await analyze_structure("some markdown")
        assert result == {}

    @pytest.mark.asyncio
    async def test_explain_formula_no_client(self, mocker):
        mocker.patch("app.services.openai_service.openai_client", None)
        from app.services.openai_service import explain_formula
        result = await explain_formula("E=mc^2")
        assert result == "LLM service not configured."

    @pytest.mark.asyncio
    async def test_find_errors_no_client(self, mocker):
        mocker.patch("app.services.openai_service.openai_client", None)
        from app.services.openai_service import find_errors
        result = await find_errors("some markdown")
        assert result == []

    @pytest.mark.asyncio
    async def test_analyze_symbols_with_client(self, mocker):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='{"symbols": [{"name": "x"}]}'))]
        mock_client.chat.completions.create = mocker.AsyncMock(return_value=mock_response)
        mocker.patch("app.services.openai_service.openai_client", mock_client)

        from app.services.openai_service import analyze_symbols
        result = await analyze_symbols("x + y = z")
        assert result == [{"name": "x"}]


class TestParseExperimentDirName:
    def test_full_format(self):
        from app.api.git import _parse_experiment_dir_name
        result = _parse_experiment_dir_name("20240115_143022_solver_v2")
        assert result["timestamp"] == "20240115_143022"
        assert result["solver_name"] == "solver_v2"

    def test_two_parts(self):
        from app.api.git import _parse_experiment_dir_name
        result = _parse_experiment_dir_name("20240115_solver")
        assert result["timestamp"] == "20240115"
        assert result["solver_name"] == "solver"

    def test_single_part(self):
        from app.api.git import _parse_experiment_dir_name
        result = _parse_experiment_dir_name("experiment")
        assert result["timestamp"] == "experiment"
        assert result["solver_name"] == "unknown"


class TestExtractParamsFromPython:
    def _mock_open(self, content: str):
        mock_file = MagicMock()
        mock_file.read.return_value = content
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_file)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        return MagicMock(return_value=mock_ctx)

    def test_numeric_params(self):
        from app.api.git import _extract_params_from_python
        with patch("builtins.open", self._mock_open("alpha = 0.5\nbeta = 1.0")):
            result = _extract_params_from_python("/fake/path.py")
            assert len(result) == 2
            assert result[0]["name"] == "alpha"
            assert result[0]["type"] == "number"

    def test_boolean_params(self):
        from app.api.git import _extract_params_from_python
        with patch("builtins.open", self._mock_open("use_cache = True")):
            result = _extract_params_from_python("/fake/path.py")
            assert len(result) == 1
            assert result[0]["type"] == "boolean"

    def test_list_params(self):
        from app.api.git import _extract_params_from_python
        with patch("builtins.open", self._mock_open("items = [1, 2, 3]")):
            result = _extract_params_from_python("/fake/path.py")
            assert len(result) == 1
            assert result[0]["type"] == "list"

    def test_skip_reserved_names(self):
        from app.api.git import _extract_params_from_python
        with patch("builtins.open", self._mock_open("import os\nprint = 1")):
            result = _extract_params_from_python("/fake/path.py")
            assert len(result) == 0


class TestCheckExperimentStructure:
    def test_complete_structure(self, mocker):
        from app.api.git import _check_experiment_structure
        mocker.patch("os.path.isdir", side_effect=lambda p: "fig" in p)
        mocker.patch("os.path.isfile", return_value=True)

        result = _check_experiment_structure("/fake/exp")
        assert result["is_complete"] is True
        assert len(result["missing"]) == 0

    def test_incomplete_structure(self, mocker):
        from app.api.git import _check_experiment_structure
        mocker.patch("os.path.isdir", return_value=False)
        mocker.patch("os.path.isfile", return_value=False)

        result = _check_experiment_structure("/fake/exp")
        assert result["is_complete"] is False
        assert len(result["missing"]) == 4
