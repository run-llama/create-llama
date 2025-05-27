This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Next.js](https://nextjs.org/) that is ejected from [`llamaindex-server`](https://github.com/run-llama/create-llama/tree/main/packages/server) via `npm eject` command.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Configuration

The same as [`llamaindex-server`](https://github.com/run-llama/create-llama/tree/main/packages/server#configuration-options), you can customize the application via .env file.

Here's the examples of how to migrate from LlamaIndexServer configs to Next.js project:

```ts
// src/index.ts
new LlamaIndexServer({
  workflow: workflowFactory,
  suggestNextQuestions: true,
  uiConfig: {
    devMode: true,
    llamaCloudIndexSelector: true,
    starterQuestions: ["Summarize the document", "What are the key points?"],
    componentsDir: "components",
    layoutDir: "layout",
  },
}).start();
```

.env file:

```
SUGGEST_NEXT_QUESTIONS=true # Whether to suggest next questions (`suggestNextQuestions`)
COMPONENTS_DIR=components # Directory for custom components (`componentsDir`)

NEXT_PUBLIC_DEV_MODE=true # Whether to enable dev mode (`devMode`)
NEXT_PUBLIC_STARTER_QUESTIONS=[] # Initial questions to display in the chat (`starterQuestions`)
NEXT_PUBLIC_SHOW_LLAMACLOUD_SELECTOR=true # Whether to show LlamaCloud selector for frontend (`llamaCloudIndexSelector`)
NEXT_PUBLIC_USE_COMPONENTS_DIR=true # Whether to use components directory for frontend
```

For customizing layout, you can directly edit the layout files in the generated nextjs project (app/components/ui/chat/layout).

## Useful Commands

- Generate Datasource (in case having `./data` folder): `npm run generate`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format: `npm run format`
- Build & Start: `npm run build && npm run start`

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai) - learn about LlamaIndex (Typescript features).

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!
