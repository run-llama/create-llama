# Sending Artifacts to the UI

In addition to UI events for custom components, LlamaIndex Server supports a special `ArtifactEvent` to send structured data like generated documents or code snippets to the UI. These artifacts are displayed in a dedicated "Canvas" panel in the chat interface.

## Artifact Event Structure

To send an artifact, your workflow needs to emit an event with `type: "artifact"`. The `data` payload of this event should include:

- `type`: An `ArtifactType` enum indicating the type of artifact (e.g., `ArtifactType.DOCUMENT`, `ArtifactType.CODE`).
- `created_at`: A timestamp (e.g., `int(time.time())`) indicating when the artifact was created.
- `data`: An object containing the specific details of the artifact. The structure of this object depends on the artifact `type`. For example, `DocumentArtifactData` or `CodeArtifactData`.

## Defining and Sending an ArtifactEvent

First, import the necessary classes:

```python
import time
from llama_index.server.api.models import (
    Artifact,
    ArtifactEvent,
    ArtifactType,
    DocumentArtifactData,
    # CodeArtifactData, # Import if sending code artifacts
)
```

Then, within your workflow logic, use `ctx.write_event_to_stream` to emit the event. Here's an example of sending a document artifact, taken from [document_workflow.py](/python/llama-index-server/examples/artifact/document_workflow.py):

```python
# Assuming 'ctx' is the workflow Context and 'content' is a markdown string

ctx.write_event_to_stream(
    ArtifactEvent(
        data=Artifact(
            type=ArtifactType.DOCUMENT,
            created_at=int(time.time()),
            data=DocumentArtifactData(
                title="My cooking recipes",
                content=content,
                type="markdown",
            ),
        ),
    )
)
```

This will send the artifact to the LlamaIndex Server UI, where it will be rendered in the Canvas panel by a renderer depending on the artifact type. For `ArtifactType.DOCUMENT`, this uses a `DocumentArtifactViewer`.

## Available Artifact Types

LlamaIndex Server currently supports the following artifact types:

- `ArtifactType.DOCUMENT`: For text-based documents like Markdown or HTML.
  - `data` should be an instance of `DocumentArtifactData` which includes `title: str`, `content: str`, and `type: Literal["markdown", "html"]`.
- `ArtifactType.CODE`: For code snippets.
  - `data` should be an instance of `CodeArtifactData` which includes `title: str`, `code: str`, and `language: str`.

Ensure you provide the correct data model corresponding to the `ArtifactType` you are sending. You can find these data models in `llama_index.server.api.models`. 