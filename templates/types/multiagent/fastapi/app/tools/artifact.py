import os
from enum import Enum
from io import BytesIO

OUTPUT_DIR = "output/tools"


class ArtifactType(Enum):
    PDF = "pdf"
    HTML = "html"


class ArtifactGenerator:
    @classmethod
    def _generate_pdf(cls, original_content: str) -> BytesIO:
        """
        Generate a PDF from the original content (markdown).
        """
        try:
            import markdown
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import Paragraph, SimpleDocTemplate
        except ImportError:
            raise ImportError(
                "Failed to import required modules. Please install reportlab and markdown."
            )

        # Convert markdown to HTML
        html = markdown.markdown(original_content)

        buffer = BytesIO()

        doc = SimpleDocTemplate(buffer, pagesize=letter)

        # Create a list to store the flowables (content elements)
        elements = []
        styles = getSampleStyleSheet()
        # TODO: Make the format nicer
        for paragraph in html.split("<p>"):
            if paragraph:
                clean_text = paragraph.replace("</p>", "").strip()
                elements.append(Paragraph(clean_text, styles["Normal"]))

        # Build the PDF document
        doc.build(elements)

        # Reset the buffer position to the beginning
        buffer.seek(0)

        return buffer

    @classmethod
    def _generate_html(cls, original_content: str) -> str:
        """
        Generate an HTML from the original content (markdown).
        """
        try:
            import markdown
        except ImportError:
            raise ImportError(
                "Failed to import required modules. Please install markdown."
            )

        # Convert markdown to HTML
        html_content = markdown.markdown(original_content)

        # Create a complete HTML document with basic styling
        html_document = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Generated HTML Document</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
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

        return html_document

    @classmethod
    def _write_to_file(cls, content: BytesIO, file_path: str):
        """
        Write the content to a file.
        """
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as file:
            file.write(content.getvalue())

    @classmethod
    def generate_artifact(
        cls, original_content: str, artifact_type: str, file_name: str
    ) -> str:
        """
        Generate an artifact from the original content and write it to a file.
        Parameters:
            original_content: str (markdown style)
            artifact_type: str (pdf or html). Use pdf for report, html for blog post.
            file_name: str (name of the artifact file), don't need to include the file extension. It will be added automatically based on the artifact type.
        Returns:
            str (URL to the artifact file): the url that already available to the file server. No need to change the path anymore.
        """
        try:
            artifact_type = ArtifactType(artifact_type.lower())
        except ValueError:
            raise ValueError(
                f"Invalid artifact type: {artifact_type}. Must be 'pdf' or 'html'."
            )

        if artifact_type == ArtifactType.PDF:
            content = cls._generate_pdf(original_content)
            file_extension = "pdf"
        elif artifact_type == ArtifactType.HTML:
            content = BytesIO(cls._generate_html(original_content).encode("utf-8"))
            file_extension = "html"
        else:
            raise ValueError(f"Unexpected artifact type: {artifact_type}")

        file_path = os.path.join(OUTPUT_DIR, f"{file_name}.{file_extension}")
        cls._write_to_file(content, file_path)
        file_url = f"{os.getenv('FILESERVER_URL_PREFIX')}/{file_path}"
        return file_url
