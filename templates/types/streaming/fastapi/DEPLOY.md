## Deployments

### Using [Fly.io](https://fly.io/):

First, install [flyctl](https://fly.io/docs/flyctl/install/) and then authenticate with your Fly.io account:

```shell
fly auth login
```

Then, run this command and follow the prompts to deploy the app.:

```shell
fly launch
```

And to open the app in your browser:

```shell
fly apps open
```

> **Note**: The app will use the values from the `.env` file by default to simplify the deployment. Make sure all the needed environment variables in the [.env](.env) file are set. For production environments, you should not use the `.env` file, but [set the variables in Fly.io](https://fly.io/docs/rails/the-basics/configuration/) instead.

#### Documents

If you're having documents in the `./data` folder, run the following command to generate vector embeddings of the documents:

```
fly console --machine <machine_id> --command "poetry run generate"
```

Where `machine_id` is the ID of the machine where the app is running. You can show the running machines with the `fly machines` command.

> **Note**: Using documents will make the app stateful. As Fly.io is a stateless app, you should use [LlamaCloud](https://docs.cloud.llamaindex.ai/llamacloud/getting_started) or a vector database to store the embeddings of the documents. This applies also for document uploads by the user.

### Using Docker

First, build an image for the app:

```
docker build -t <your_image_name> .
```

Then, start the app by running the image:

```
docker run \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/storage:/app/storage \ # Use your file system to store vector embeddings
  -p 8000:8000 \
  <your_image_name>
```

Open [http://localhost:8000](http://localhost:8000) with your browser to start the app.

#### Documents

If you're having documents in the `./data` folder, run the following command to generate vector embeddings of the documents:

```
docker run \
  --rm \
  -v $(pwd)/.env:/app/.env \ # Use ENV variables and configuration from your file-system
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \ # Use your local folder to read the data
  -v $(pwd)/storage:/app/storage \ # Use your file system to store the vector database
  <your_image_name> \
  poetry run generate
```

The app will then be able to answer questions about the documents in the `./data` folder.
