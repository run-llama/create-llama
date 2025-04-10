# Custom UI Components

The LlamaIndex server provides support for rendering workflow events using custom UI components, allowing you to extend and customize the chat interface.

## Overview

Custom UI components are a powerful feature that enables you to:

- Add custom interface elements to the chat UI using React JSX or TSX files
- Extend the default chat interface functionality
- Create specialized visualizations or interactions

## Configuration

### Workflow events

Your workflow must emit events that fit this structure, allowing the LlamaIndex server to display the right UI components based on the event type.

```json
{
    "type": "<event_name>",
    "data": <data model>
}
```

In Pydantic, this is equivalent to:

```python
from pydantic import BaseModel
from typing import Literal, Any

class MyCustomEvent(BaseModel):
    type: Literal["<my_custom_event_name>"]
    data: dict | Any

    def to_response(self):
        return self.model_dump()
```

### Server Setup

1. Initialize the LlamaIndex server with a component directory:

```python
server = LlamaIndexServer(
    workflow_factory=your_workflow,
    component_dir="path/to/components",
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
