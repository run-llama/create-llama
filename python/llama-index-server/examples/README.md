# Examples for llama-index-server

This directory contains examples for llama-index-server.

## How to run the examples

1. Make sure you have [uv](https://docs.astral.sh/uv/) installed.

2. Install the dependencies (with published packages) by running the following command:

    ```bash
    uv sync
    ```

3. Navigate to one of the example folders and follow the instructions in the example's README.md file:

- [Simple Agent](./simple-agent/README.md)
- [HITL](./hitl/README.md)
- [Artifact](./artifact/README.md)
- [LlamaCloud](./llamacloud/README.md)

## Local Development

1. For local development, you first need to build the UI resources for the server. At the root of the project, run the following command:

    ```bash
    pnpm install
    pnpm build
    ```

2. Config to use the local llama-index-server package:

    To run the examples with the local llama-index-server package, you need to tell uv to use the virtual environment of the root project
    by setting the `UV_PROJECT` environment variable.

    ```bash
    export UV_PROJECT=<absolute path of the root project>
    ```

    Then continue with step 3 above.

    > You can also use `--project <path to the root project>` instead of setting the `UV_PROJECT` environment variable.

