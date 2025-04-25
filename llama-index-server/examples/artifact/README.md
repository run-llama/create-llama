# Artifacts App

This guide explains how to set up and use the LlamaIndex server with the artifact workflow to write code or documents.

## Prerequisites

- [uv](https://github.com/astral-sh/uv) installed (a fast Python package manager and runner)
- An OpenAI API key

## Steps

1. **Set the OpenAI API Key**

   Export your OpenAI API key as an environment variable:

   ```sh
   export OPENAI_API_KEY=your_openai_api_key_here
   ```

2. **Run the Server Using uv**

   Start the server with the following command:

   ```sh
   uv run main.py
   ```

   This will launch the FastAPI server using the workflow defined in `main.py`.

3. **Access the Application**

   Open your browser and go to:

   ```
   http://localhost:8000
   ```

   You will see the LlamaIndex Artifact app UI, where you can interact with the workflow.

## Notes

- By default, the server uses the code artifact workflow. If you want to use the document artifact workflow, edit `main.py` and uncomment the following line:

  ```python
  # from examples.artifact.document_workflow import ArtifactWorkflow
  ```

  and comment out the code workflow import.

- The UI provides starter questions to help you get started, or you can enter your own requests.

- The workflow will guide you through planning and generating code or documents based on your input.
