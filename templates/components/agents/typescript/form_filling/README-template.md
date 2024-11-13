This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Next.js](https://nextjs.org/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama).

## Getting Started

First, install the dependencies:

```
npm install
```

Then check the parameters that have been pre-configured in the `.env` file in this directory.
Make sure you have the `OPENAI_API_KEY` set.

Second, run the development server:

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the chat UI.

## Use Case: Filling Financial CSV Template

1. Upload the Apple and Tesla financial reports from the [data](./data) directory. Just send an empty message.
2. Upload the CSV file [sec_10k_template.csv](./sec_10k_template.csv) and send the message "Fill the missing cells in the CSV file".

The agent will fill the missing cells by retrieving the information from the uploaded financial reports and return a new CSV file with the filled cells.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex (Python features).
- [LlamaIndexTS Documentation](https://ts.llamaindex.ai/docs/llamaindex) - learn about LlamaIndex (Typescript features).
- [Workflows Introduction](https://ts.llamaindex.ai/docs/llamaindex/guide/workflow) - learn about LlamaIndexTS workflows.

You can check out [the LlamaIndexTS GitHub repository](https://github.com/run-llama/LlamaIndexTS) - your feedback and contributions are welcome!
