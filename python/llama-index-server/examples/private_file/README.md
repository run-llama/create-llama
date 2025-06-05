# Uploaded File

This example shows how to use the uploaded file (private file) from the user in the workflow.

## Prerequisites

Please follow the setup instructions in the [examples README](../README.md).

You will also need:
- An OpenAI API key
- Text files for processing (the examples are optimized for smaller text files)

## How to get the uploaded files in your workflow:

The uploaded file information is included in the annotations of a [ChatAPIMessage](../../llama_index/server/models/chat.py#66). You can manually access it through the `chat_request` parameter in the workflow factory. We already provided a [get_file_attachments](../../llama_index/server/utils/chat_attachments.py) helper function to get the uploaded files from the chat request easier.

```python
from llama_index.server.api.utils.chat_attachments import get_file_attachments

def create_workflow(chat_request: ChatRequest) -> Workflow:
    uploaded_files = get_file_attachments(chat_request.messages)
    ...
```

Each uploaded file item is a [ServerFile](../../llama_index/server/models/chat.py#9) object, which includes the file id, type, size, and url of the uploaded file. The `url` is an access url to the uploaded file that can be used to download or display the file from the browser, the `id` is used to manage the file in the server through the [FileService](../../llama_index/server/services/file.py).


## Examples:

### For agent workflow:
   - We create a simple file reader tool that can read the uploaded file content.

   ```python
   def create_file_tool(chat_request: ChatRequest) -> Optional[FunctionTool]:
      """
      Create a tool to read file if the user uploads a file.
      """
      file_ids = []
      # Get the uploaded file ids from the the chat messages
      for file in get_file_attachments(chat_request.messages):
         file_ids.append(file.id)
      if len(file_ids) == 0:
         return None

      # Create a tool description that includes the file ids so the LLM knows which file it can access
      file_tool_description = (
         "Use this tool with a file id to read the content of the file."
         f"\nYou only have access to the following file ids: {json.dumps(file_ids)}"
      )

      def read_file(file_id: str) -> str:
         file_path = FileService.get_file_path(file_id)
         try:
               with open(file_path, "r") as file:
                  return file.read()
         except Exception as e:
               return f"Error reading file {file_path}: {e}"
      
      # Create the tool
      return FunctionTool.from_defaults(
         fn=read_file,
         name="read_file",
         description=file_tool_description,
      )
   ```
   - Check out the [agent-workflow.py](agent-workflow.py) for more details.

   - You can run the agent workflow with file tool by running the following command:
     ```bash
     export OPENAI_API_KEY=your_openai_api_key_here
     uv run agent-workflow.py
     ```
     then go to the UI at `http://localhost:8000` and upload the [example.txt](example.txt) file.

### For custom workflow:
   - The attachments are included in the `attachments` parameter of the `StartEvent` so you can easily access them in the workflow.

   ```python
   class MyWorkflow(Workflow):
      @step
      async def start_event_handler(self, ctx: Context, ev: StartEvent) -> StopEvent:
         # Get attachments from the start event
         attachments = ev.attachments
         # Do something with the attachments
         # e.g. read the file content
         last_file = attachments[-1]
         if last_file:
            with open(last_file.path, "r") as f:
               file_content = f.read()
            ...
         # or save it to the context for later use
         await ctx.set("file_content", file_content)
         return StopEvent()
   ```
   - Check out the [custom-workflow.py](custom-workflow.py) for more details.

   - You can run the custom workflow by running the following command:
     ```bash
     export OPENAI_API_KEY=your_openai_api_key_here
     uv run custom-workflow.py
     ```
     then go to the UI at `http://localhost:8000` and upload the [example.txt](example.txt) file.