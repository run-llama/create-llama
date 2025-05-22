This example shows how to use the dev mode of the server.

First, we need to set `devMode` to `true` in the `uiConfig` of the server.

```ts
new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    devMode: true,
  },
  port: 3000,
}).start();
```

Export OpenAI API key and start the server in dev mode.

```bash
export OPENAI_API_KEY=<your-openai-api-key>
npx nodemon --exec tsx index.ts --ignore src/app/workflow_*.ts
```
