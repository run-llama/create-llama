This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Next.js](https://nextjs.org/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, install the dependencies:

```
npm install
```

Second, generate the embeddings of the documents in the `./data` directory (if this folder exists - otherwise, skip this step):

```
npm run generate
```

Third, run the development server:

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Using docker

1. Build an image for Next app:

```
docker build -t <your_app_image_name> .
```

2. Start the app:

- Generate the embedding for `./data` folder if it exists - otherwise, skip this step:

```
docker run \
  --rm \
  -v $(pwd)/.env:/app/.env  \
  -v ./storage:/app/storage \ # Can remove this option if you us a vector data base
  -p 3000:3000 \
  npm run generate
```

- Start the API

```
docker run \
  --rm \
  -v $(pwd)/.env:/app/.env \
  -p 3000:3000 \
  <your_app_image_name>
```

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai) - learn about LlamaIndex (Typescript features).

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!
