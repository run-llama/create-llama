This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Next.js](https://nextjs.org/) that is ejected from [`llamaindex-server`](https://github.com/run-llama/create-llama/tree/main/packages/server) via `npm eject` command.

## Quick Start

As this is a Next.js project, you can use the following commands to start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Useful Commands

- Generate Datasource (in case you're having a `./data` folder): `npm run generate`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Format: `npm run format`
- Build & Start: `npm run build && npm run start`

## Deployment

The project can be deployed to any platform that supports Next.js like Vercel.

## Configuration

Your original [`llamaindex-server`](https://github.com/run-llama/create-llama/tree/main/packages/server#configuration-options) configurations have been migrated to a [`.env`](.env) file.

Changing the `.env` file will change the behavior of the application, e.g. for changing the initial questions to display in the chat, you can do:

```
NEXT_PUBLIC_STARTER_QUESTIONS=['What is the capital of France?']
```

Alternatively, you can also change the file referencing `process.env.NEXT_PUBLIC_STARTER_QUESTIONS` directly in the source code.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai) - learn about LlamaIndex (Typescript features).

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!
