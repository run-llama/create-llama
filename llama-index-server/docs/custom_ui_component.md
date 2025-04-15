# Custom UI Components

The LlamaIndex server provides support for rendering workflow events using custom UI components, allowing you to extend and customize the chat interface.

## Overview

Custom UI components are a powerful feature that enables you to:

- Add custom interface elements to the chat UI using React JSX or TSX files
- Extend the default chat interface functionality
- Create specialized visualizations or interactions

## Configuration

### Workflow events

To display custom UI components, your workflow needs to emit `UIEvent` events with data that conforms to the data model of your custom UI component.

```python
from llama_index.server import UIEvent
from pydantic import BaseModel, Field
from typing import Literal, Any

# Define a Pydantic model for your event data
class DeepResearchEventData(BaseModel):
    id: str = Field(description="The unique identifier for the event")
    type: Literal["retrieval", "analysis"] = Field(description="DeepResearch has two main stages: retrieval and analysis")
    status: Literal["pending", "completed", "failed"] = Field(description="The current status of the event")
    content: str = Field(description="The textual content of the event")


# In your workflow, emit the data model with UIEvent
ctx.write_event_to_stream(
    UIEvent(
        type="deep_research_event",
        data=DeepResearchEventData(
            id="123",
            type="retrieval",
            status="pending",
            content="Retrieving data...",
        ),
    )
)
```

### Server Setup

1. Initialize the LlamaIndex server with a component directory:

```python
server = LlamaIndexServer(
    workflow_factory=your_workflow,
    ui_config={
        "component_dir": "path/to/components",
    },
    include_ui=True
)
```

2. Add the custom component code to the directory following the naming pattern:

   - File Extension: `.jsx` and `.tsx` for React components
   - File Name: Should match the event type from your workflow (e.g., `deep_research_event.jsx` for handling `deep_research_event` type that you defined in your workflow). If there are TSX and JSX files with the same name, the TSX file will be used.
   - Component Name: Export a default React component named `Component` that receives props from the event data

   Example component structure:

   ```jsx
   function Component({ events }) {
       // Your component logic here
       return (
           // Your UI code here
       );
   }
   ```

### Generate UI Component

We provide a `generate_event_component` function that uses LLMs to automatically generate UI components for your workflow events.

```python
from llama_index.server.gen_ui import generate_event_component
from llama_index.llms.openai import OpenAI

# Generate a component using the event class you defined in your workflow
from your_workflow import DeepResearchEvent
ui_code = await generate_event_component(
    event_cls=DeepResearchEvent,
    llm=OpenAI(model="gpt-4.1"), # Default LLM is Claude 3.7 Sonnet if not provided
)

# Alternatively, generate from your workflow file
ui_code = await generate_event_component(
    workflow_file="your_workflow.py",
)
print(ui_code)

# Save the generated code to a file for use in your project
with open("deep_research_event.jsx", "w") as f:
    f.write(ui_code)
```

> **Tip:** For optimal results, add descriptive documentation to each field in your event data class. This helps the LLM better understand your data structure and generate more appropriate UI components. We also recommend using GPT 4.1, Claude 3.7 Sonnet and Gemini 2.5 Pro for better results.
