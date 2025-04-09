# Custom UI Components

The LlamaIndex server provides support for custom UI components, allowing you to extend and customize the chat interface according to your needs.

## Overview

Custom UI components are a powerful feature that enables you to:

- Add custom interface elements to the chat UI
- Extend the default chat interface functionality
- Create specialized visualizations or interactions

## Configuration

### Server Setup

To enable custom UI components, you need to:

1. Initialize the LlamaIndex server with a component directory:

```python
server = LlamaIndexServer(
    workflow_factory=your_workflow,
    component_dir="path/to/components",
    include_ui=True
)
```

2. Add the custom component code to the directory following the naming pattern:

   - File Extension: `.jsx` for React components
   - File Name: Should match the event type from your workflow (e.g., `deep_research_event.jsx` for handling `deep_research_event` type)
   - Component Name: Export a default React component named `Component` that receives props from the event data

   Example component structure:

   ```jsx
   function Component({ events }) {
       // Your component logic here
       return (
           // Your JSX here
       );
   }
   ```
