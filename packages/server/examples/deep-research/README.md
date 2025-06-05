This example demonstrates how to use the deep research workflow.

```ts
new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    starterQuestions: [
      "Research about Google and Apple",
      "List all the services of Google and Apple",
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
