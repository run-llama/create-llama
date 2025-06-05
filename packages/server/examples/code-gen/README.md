This example demonstrates how to use the code generation workflow.

```ts
new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    starterQuestions: [
      "Generate a calculator app",
      "Create a simple todo list app",
    ],
    componentsDir: "components",
  },
  port: 3000,
}).start();
```

Export OpenAI API key and start the server in dev mode.

```bash
export OPENAI_API_KEY=<your-openai-api-key>
npx nodemon --exec tsx index.ts
```
