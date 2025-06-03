# LlamaCloud Integration

This guide explains how to set up and use the LlamaIndex server with LlamaCloud for retrieval-augmented generation (RAG) with citation support.

## Prerequisites

Please follow the setup instructions in the [examples README](../README.md).

You will also need:
- An OpenAI API key
- A LlamaCloud account and API key
- A LlamaCloud project with indexed documents

## Steps

1. **Set the Required Environment Variables**

   Export your API keys and LlamaCloud configuration:

   ```sh
   export OPENAI_API_KEY=your_openai_api_key_here
   export LLAMA_CLOUD_API_KEY=your_llamacloud_api_key_here
   export LLAMA_CLOUD_PROJECT_NAME=your_project_name
   export LLAMA_CLOUD_INDEX_NAME=your_index_name
   ```

2. **Run the Server Using uv**

   Start the server with the following command:

   ```sh
   uv run main.py
   ```

   This will launch the FastAPI server using the LlamaCloud workflow defined in `main.py`.

3. **Access the Application**

   Open your browser and go to:

   ```
   http://localhost:8000
   ```

   You will see the LlamaIndex chat app UI with LlamaCloud integration, where you can query your indexed documents.

## Features

- **Document Retrieval**: Query your LlamaCloud indexed documents with two retrieval modes:
  - **Chunk-level retrieval**: Best for specific, detailed questions requiring precise information
  - **Document-level retrieval**: Best for high-level summarization and broader context questions
- **Citation Support**: All responses include citations to the source documents, helping you verify and trace the information back to its origin.
- **Index Selection**: The UI includes an index selector, allowing you to switch between different LlamaCloud indexes if you have multiple of them.

## How it Works

The workflow uses two specialized query engines:

1. **Chunk Query Engine**: Retrieves specific chunks of documents for detailed, targeted questions
2. **File Query Engine**: Retrieves entire documents as context for broader, summarization-type questions

Both engines are enhanced with citation capabilities, ensuring transparency and traceability in the responses.

## Notes

- Make sure your LlamaCloud project has documents indexed before running the example
- The server uses GPT-4.1 by default for optimal performance with citations
- The workflow automatically selects the appropriate retrieval strategy based on your query type 