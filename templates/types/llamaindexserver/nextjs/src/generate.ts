import "dotenv/config";
import { SimpleDirectoryReader } from "@llamaindex/readers/directory";
import { storageContextFromDefaults, VectorStoreIndex } from "llamaindex";
import { initSettings } from "./app/settings";
import fs from "fs";

async function generateDatasource() {
  console.log(`Generating storage context...`);
  // Split documents, create embeddings and store them in the storage context
  const storageContext = await storageContextFromDefaults({
    persistDir: "storage",
  });
  // load documents from current directoy into an index
  const reader = new SimpleDirectoryReader();
  const documents = await reader.loadData("data");

  await VectorStoreIndex.fromDocuments(documents, {
    storageContext,
  });
  console.log("Storage context successfully generated.");
}

async function generateUi() {
  // Dynamically import UI-related modules
  const { generateEventComponent } = await import("./gen-ui");
  const { UIEventSchema } = await import("./app/workflow");

  const generatedCode = await generateEventComponent(UIEventSchema);
  // Write the generated code to components/ui_event.ts
  fs.writeFileSync("components/ui_event.jsx", generatedCode);
}

(async () => {
  const args = process.argv.slice(2);
  const command = args[0];

  initSettings();

  if (command === "datasource") {
    await generateDatasource();
  } else if (command === "ui") {
    await generateUi();
  } else {
    console.error(
      'Invalid command. Please use "datasource" or "ui". Running "datasource" by default.',
    );
    await generateDatasource(); // Default behavior or could throw an error
  }
})();
