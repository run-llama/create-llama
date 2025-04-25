import { QdrantClient } from "@qdrant/js-client-rest";

const REQUIRED_ENV_VARS = ["QDRANT_URL", "QDRANT_COLLECTION"]; // QDRANT_API_KEY is optional

export function getQdrantClient() {
  const url = process.env.QDRANT_URL;
  if (!url) {
    throw new Error("QDRANT_URL environment variable is required");
  }
  const apiKey = process.env?.QDRANT_API_KEY;
  return new QdrantClient({
    url,
    apiKey,
  });
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
