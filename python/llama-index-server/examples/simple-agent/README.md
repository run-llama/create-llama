# A simple chat app

This guide explains how to set up and use the LlamaIndex server with a simple chatbot agent.

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
   uv run workflow.py
   ```

   This will launch the FastAPI server using the workflow defined in `main.py`.

3. **Access the Application**

   Open your browser and go to:

   ```
   http://localhost:8000
   ```

   You will see the LlamaIndex chat app UI, where you can interact with the agent.