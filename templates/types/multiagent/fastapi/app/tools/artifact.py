import os
import re
from enum import Enum
from io import BytesIO

OUTPUT_DIR = "output/tools"


class ArtifactType(Enum):
    PDF = "pdf"
    HTML = "html"


HTML_FILE_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.3;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1, h2, h3, h4, h5, h6 {{
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }}
        p {{
            margin-bottom: 1em;
        }}
        code {{
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 4px;
        }}
        pre {{
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>
"""


class ArtifactGenerator:
    @classmethod
    def _generate_html_content(cls, original_content: str) -> str:
        """
        Generate HTML content from the original markdown content.
        """
        try:
            import markdown
        except ImportError:
            raise ImportError(
                "Failed to import required modules. Please install markdown."
            )

        # Convert markdown to HTML
        html_content = markdown.markdown(original_content)
        return html_content

    @classmethod
    def _generate_pdf(cls, html_content: str) -> BytesIO:
        """
        Generate a PDF from the HTML content.
        """
        try:
            from xhtml2pdf import pisa
        except ImportError:
            raise ImportError(
                "Failed to import required modules. Please install xhtml2pdf."
            )

        buffer = BytesIO()
        pdf = pisa.pisaDocument(
            BytesIO(html_content.encode("UTF-8")),
            buffer,
            encoding="UTF-8",
            path=".",
            link_callback=None,
            debug=0,
            default_css=None,
            xhtml=False,
            xml_output=None,
            ident=0,
            show_error_as_pdf=False,
            quiet=True,
            capacity=100 * 1024 * 1024,
            raise_exception=True,
        )
        if pdf.err:
            raise ValueError("PDF generation failed")
        buffer.seek(0)
        return buffer

    @classmethod
    def _generate_html(cls, html_content: str) -> str:
        """
        Generate a complete HTML document with the given HTML content.
        """
        return HTML_FILE_TEMPLATE.format(html_content=html_content)

    @classmethod
    def generate_artifact(
        cls, original_content: str, artifact_type: str, file_name: str
    ) -> str:
        """
        To generate artifact as PDF or HTML file.
        Parameters:
            original_content: str (markdown style)
            artifact_type: str (pdf or html) specify the type of the file format based on the use case
            file_name: str (name of the artifact file) must be a valid file name, no extensions needed
        Returns:
            str (URL to the artifact file): A file URL ready to serve.
        """
        try:
            artifact_type = ArtifactType(artifact_type.lower())
        except ValueError:
            raise ValueError(
                f"Invalid artifact type: {artifact_type}. Must be 'pdf' or 'html'."
            )
        # Always generate html content first
        html_content = cls._generate_html_content(original_content)

        # Based on the type of artifact, generate the corresponding file
        if artifact_type == ArtifactType.PDF:
            content = cls._generate_pdf(cls._generate_html(html_content))
            file_extension = "pdf"
        elif artifact_type == ArtifactType.HTML:
            content = BytesIO(cls._generate_html(html_content).encode("utf-8"))
            file_extension = "html"
        else:
            raise ValueError(f"Unexpected artifact type: {artifact_type}")

        file_name = cls._validate_file_name(file_name)
        file_path = os.path.join(OUTPUT_DIR, f"{file_name}.{file_extension}")

        cls._write_to_file(content, file_path)

        file_url = f"{os.getenv('FILESERVER_URL_PREFIX')}/{file_path}"
        return file_url

    @staticmethod
    def _write_to_file(content: BytesIO, file_path: str):
        """
        Write the content to a file.
        """
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as file:
                file.write(content.getvalue())
        except Exception as e:
            raise e

    @staticmethod
    def _validate_file_name(file_name: str) -> str:
        """
        Validate the file name.
        """
        # Don't allow directory traversal
        if os.path.isabs(file_name):
            raise ValueError("File name is not allowed.")
        # Don't allow special characters
        if re.match(r"^[a-zA-Z0-9_.-]+$", file_name):
            return file_name
        else:
            raise ValueError("File name is not allowed to contain special characters.")
