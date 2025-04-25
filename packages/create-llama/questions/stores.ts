import fs from "fs";
import path from "path";
import { TemplateFramework } from "../helpers";
import { templatesDir } from "../helpers/dir";

export const getVectorDbChoices = (framework: TemplateFramework) => {
  const choices = [
    {
      title: "No, just store the data in the file system",
      value: "none",
    },
    { title: "MongoDB", value: "mongo" },
    { title: "PostgreSQL", value: "pg" },
    { title: "Pinecone", value: "pinecone" },
    { title: "Milvus", value: "milvus" },
    { title: "Astra", value: "astra" },
    { title: "Qdrant", value: "qdrant" },
    { title: "ChromaDB", value: "chroma" },
    { title: "Weaviate", value: "weaviate" },
    { title: "LlamaCloud (use Managed Index)", value: "llamacloud" },
  ];

  const vectordbLang = framework === "fastapi" ? "python" : "typescript";
  const compPath = path.join(templatesDir, "components");
  const vectordbPath = path.join(compPath, "vectordbs", vectordbLang);

  const availableChoices = fs
    .readdirSync(vectordbPath)
    .filter((file) => fs.statSync(path.join(vectordbPath, file)).isDirectory());

  const displayedChoices = choices.filter((choice) =>
    availableChoices.includes(choice.value),
  );

  return displayedChoices;
};
