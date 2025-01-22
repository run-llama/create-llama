This is a [LlamaIndex](https://www.llamaindex.ai/) multi-agents project using [Workflows](https://docs.llamaindex.ai/en/stable/understanding/workflows/).

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
poetry install
```

Then check the parameters that have been pre-configured in the `.env` file in this directory. (E.g. you might need to configure an `OPENAI_API_KEY` if you're using OpenAI as model provider).
Second, generate the embeddings of the documents in the `./data` directory:

```shell
poetry run generate
```

Third, run the development server:

```shell
poetry run dev
```

## Use Case: Deep Research over own documents

The workflow performs deep research by retrieving and analyzing documents from the [data](./data) directory from multiple perspectives. The project includes a sample PDF about AI investment in 2024 to help you get started. You can also add your own documents by placing them in the data directory and running the generate script again to index them.

After starting the server, go to [http://localhost:8000](http://localhost:8000) and send a message to the agent to write a blog post.
E.g: "AI investment in 2024"

To update the workflow, you can edit the [deep_research.py](./app/workflows/deep_research.py) file.

By default, the workflow retrieves 10 results from your documents. To customize the amount of information covered in the answer, you can adjust the `TOP_K` environment variable in the `.env` file. A higher value will retrieve more results from your documents, potentially providing more comprehensive answers.

## Deployments

For production deployments, check the [DEPLOY.md](DEPLOY.md) file.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.
- [Workflows Introduction](https://docs.llamaindex.ai/en/stable/understanding/workflows/) - learn about LlamaIndex workflows.
  You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!
