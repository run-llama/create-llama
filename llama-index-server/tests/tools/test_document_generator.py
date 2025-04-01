from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from llama_index.server.tools.document_generator import (
    OUTPUT_DIR,
    DocumentGenerator,
)


class TestDocumentGenerator:
    def test_validate_file_name(self) -> None:
        # Valid names
        assert (
            DocumentGenerator("/api/files")._validate_file_name("valid-name")
            == "valid-name"
        )

        # Invalid names
        with pytest.raises(ValueError):
            DocumentGenerator("/api/files")._validate_file_name("/invalid/path")

    @patch("os.makedirs")
    @patch("builtins.open")
    def test_write_to_file(self, mock_open, mock_makedirs):  # type: ignore
        content = BytesIO(b"test")
        DocumentGenerator("/api/files")._write_to_file(content, "path/file.txt")

        mock_makedirs.assert_called_once()
        mock_open.assert_called_once()
        mock_open.return_value.__enter__.return_value.write.assert_called_once_with(
            b"test"
        )

    @patch("markdown.markdown")
    def test_html_generation(self, mock_markdown):  # type: ignore
        mock_markdown.return_value = "<h1>Test</h1>"

        # Test HTML content generation
        assert (
            DocumentGenerator("/api/files")._generate_html_content("# Test")
            == "<h1>Test</h1>"
        )

        # Test full HTML generation
        html = DocumentGenerator("/api/files")._generate_html("<h1>Test</h1>")
        assert "<!DOCTYPE html>" in html
        assert "<h1>Test</h1>" in html

    @patch("xhtml2pdf.pisa.pisaDocument")
    def test_pdf_generation(self, mock_pisa):  # type: ignore
        # Success case
        mock_pisa.return_value = MagicMock(err=None)
        assert isinstance(
            DocumentGenerator("/api/files")._generate_pdf("test"), BytesIO
        )

        # Error case
        mock_pisa.return_value = MagicMock(err="Error")
        with pytest.raises(ValueError):
            DocumentGenerator("/api/files")._generate_pdf("test")

    @patch.multiple(
        DocumentGenerator,
        _generate_html_content=MagicMock(return_value="<h1>Test</h1>"),
        _generate_html=MagicMock(
            return_value="<html><body><h1>Test</h1></body></html>"
        ),
        _generate_pdf=MagicMock(return_value=BytesIO(b"pdf")),
        _write_to_file=MagicMock(),
    )
    def test_generate_document(self):  # type: ignore
        # HTML generation
        url = DocumentGenerator("/api/files").generate_document(
            "# Test", "html", "test-doc"
        )
        assert url == f"/api/files/{OUTPUT_DIR}/test-doc.html"

        # PDF generation
        url = DocumentGenerator("/api/files").generate_document(
            "# Test", "pdf", "test-doc"
        )
        assert url == f"/api/files/{OUTPUT_DIR}/test-doc.pdf"

        # Invalid type
        with pytest.raises(ValueError):
            DocumentGenerator("/api/files").generate_document(
                "# Test", "invalid", "test-doc"
            )
