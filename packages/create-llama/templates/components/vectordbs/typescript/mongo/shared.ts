const REQUIRED_ENV_VARS = [
  "MONGODB_URI",
  "MONGODB_DATABASE",
  "MONGODB_VECTORS",
  "MONGODB_VECTOR_INDEX",
];

export const POPULATED_METADATA_FIELDS = ["private", "doc_id"]; // for filtering in MongoDB VectorSearchIndex

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
