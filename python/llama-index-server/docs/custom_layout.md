# Custom Layout

LlamaIndex Server supports custom layout for header and footer. To use custom layout, you need to initialize the LlamaIndex server with the `layout_dir` that contains your custom layout files.

```python
server = LlamaIndexServer(
    workflow_factory=your_workflow,
    ui_config={
        "layout_dir": "path/to/layout",
    },
    include_ui=True
)
```

```
layout/
  header.tsx
  footer.tsx
```

We currently support custom header and footer for the chat interface. The syntax for these files is the same as events components in components directory (see [Custom UI Component](./custom_ui_component.md) for more details).
Note that by default, we are still rendering the default LlamaIndex Header. It's also the fallback when having errors rendering the custom header.
