const REQUIRED_ENV_VARS = ["WEAVIATE_CLUSTER_URL", "WEAVIATE_API_KEY"];

export function getWeaviateClient() {
  const url = process.env.WEAVIATE_CLUSTER_URL;
  const apiKey = process.env.WEAVIATE_API_KEY;
  // TODO: Add Weaviate client when available
}

export function checkRequiredEnvVars() {
  const missingEnvVars = REQUIRED_ENV_VARS.filter((envVar) => {
    return !process.env[envVar];
  });

  if (missingEnvVars.length > 0) {
    console.log(
      `The following environment variables are required but missing: ${missingEnvVars.join(
        ", ",
      )}`,
    );
    throw new Error(
      `Missing environment variables: ${missingEnvVars.join(", ")}`,
    );
  }
}
