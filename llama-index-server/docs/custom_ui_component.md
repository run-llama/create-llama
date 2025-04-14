# Custom UI Components

The LlamaIndex server provides support for rendering workflow events using custom UI components, allowing you to extend and customize the chat interface.

## Overview

Custom UI components are a powerful feature that enables you to:

- Add custom interface elements to the chat UI using React JSX or TSX files
- Extend the default chat interface functionality
- Create specialized visualizations or interactions

## Configuration

### Workflow events

To use custom UI components, your workflow must emit an `UIEvent` with data that matches the data model of the custom UI component.

```python
from llama_index.server import UIEvent
from pydantic import BaseModel, Field
from typing import Literal, Any

# A Pydantic model that defines the data model for the event.
# If you use generate ui function, you should define the description for the fields to help LLM understand your event.
class DeepResearchEventData(BaseModel):
    id: str = Field(description="The id of the event")
    type: Enum["retrieval", "analysis"] = Field(description="DeepResearch has two main stages: retrieval and analysis.")
    status: Enum["pending", "completed", "failed"] = Field(description="The status of the event")
    content: str = Field(description="The content of the event")


# Then in your workflow, you should emit this event when you want to render a custom UI component.
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

### Generate UI component

We provide a `generate_ui_component` function to help you leverage LLM to generate the UI component for your workflow events.

```python
from llama_index.server.gen_ui.main import generate_ui_component

# Call generate_ui_component with the event class you defined in your workflow.
from your_workflow import DeepResearchEvent
ui_code = await generate_ui_component(
    event_cls=DeepResearchEvent,
)
# Or, you can generate from your workflow file.
ui_code = await generate_ui_component(
    workflow_file="your_workflow.py",
)
print(ui_code)

# You can save the code to a file and use it in your project.
with open("deep_research_event.jsx", "w") as f:
    f.write(ui_code)
```

> Tips: For the best result, you should add the description for the fields in the event data class so that the LLM can get the best understanding of your event data.
