This is a [LlamaIndex](https://www.llamaindex.ai/) project using [Reflex](https://reflex.dev/) bootstrapped with [`create-llama`](https://github.com/run-llama/LlamaIndexTS/tree/main/packages/create-llama) featuring automated contract review and compliance analysis use case.

## Getting Started

First, setup the environment with poetry:

> **_Note:_** This step is not needed if you are using the dev-container.

```shell
uv sync
```

Then check the parameters that have been pre-configured in the `.env` file in this directory. (E.g. you might need to configure an `OPENAI_API_KEY` if you're using OpenAI as model provider).

Second, generate the embeddings of the example document in the `./data` directory:

```shell
uv run generate
```

Third, start app with `reflex` command:

```shell
uv run reflex run
```

To deploy the application, refer to the Reflex deployment guide: https://reflex.dev/docs/hosting/deploy-quick-start/

### UI

The application provides an interactive web interface accessible at http://localhost:3000 for testing the contract review workflow.

To get started:

1. Upload a contract document:

   - Use the provided [example_vendor_agreement.md](./example_vendor_agreement.md) for testing
   - Or upload your own document (supported formats: PDF, TXT, Markdown, DOCX)

2. Review Process:
   - The system will automatically analyze your document against compliance guidelines
   - By default, it uses [GDPR](./data/gdpr.pdf) as the compliance benchmark
   - Custom guidelines can be used by adding your policy documents to the `./data` directory and running `poetry run generate` to update the embeddings

The interface will display the analysis results for the compliance of the contract document.

### Development

You can start editing the backend workflow by modifying the [`ContractReviewWorkflow`](./app/services/contract_reviewer.py).

For UI, you can start looking at the [`AppState`](./app/ui/states/app.py) code and navigating to the appropriate components.

## Learn More

To learn more about LlamaIndex, take a look at the following resources:

- [LlamaIndex Documentation](https://docs.llamaindex.ai) - learn about LlamaIndex.

You can check out [the LlamaIndex GitHub repository](https://github.com/run-llama/llama_index) - your feedback and contributions are welcome!
