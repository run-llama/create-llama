import {
  client,
  PipelinesService,
  ProjectsService,
} from "@llamaindex/cloud/api";
import { DEFAULT_BASE_URL } from "@llamaindex/core/global";

function initService(apiKey?: string) {
  client.setConfig({
    baseUrl: DEFAULT_BASE_URL,
    throwOnError: true,
  });
  const token = apiKey ?? process.env.LLAMA_CLOUD_API_KEY;
  client.interceptors.request.use((request: any) => {
    request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  });
  if (!token) {
    throw new Error(
      "API Key is required for LlamaCloudIndex. Please set the LLAMA_CLOUD_API_KEY environment variable",
    );
  }
}

async function getProjectId(projectName: string): Promise<string> {
  const { data: projects } = await ProjectsService.listProjectsApiV1ProjectsGet(
    {
      query: {
        project_name: projectName,
      },
      throwOnError: true,
    },
  );

  if (projects.length === 0) {
    throw new Error(
      `Unknown project name ${projectName}. Please confirm a managed project with this name exists.`,
    );
  } else if (projects.length > 1) {
    throw new Error(
      `Multiple projects found with name ${projectName}. Please specify organization_id.`,
    );
  }

  const project = projects[0]!;

  if (!project.id) {
    throw new Error(`No project found with name ${projectName}`);
  }

  return project.id;
}

async function deletePipelines(projectName: string) {
  try {
    initService();

    const projectId = await getProjectId(projectName);

    const { data: pipelines } =
      await PipelinesService.searchPipelinesApiV1PipelinesGet({
        query: { project_id: projectId },
        throwOnError: true,
      });

    console.log(`Deleting pipelines for project "${projectName}":`);

    for (const pipeline of pipelines) {
      if (pipeline.id) {
        try {
          await PipelinesService.deletePipelineApiV1PipelinesPipelineIdDelete({
            path: { pipeline_id: pipeline.id },
            throwOnError: true,
          });
          console.log(
            `✅ Deleted pipeline: ${pipeline.name} (ID: ${pipeline.id})`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to delete pipeline: ${pipeline.name} (ID: ${pipeline.id})`,
          );
          console.error(
            `   Error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        console.warn(`⚠️ Skipping pipeline with no ID: ${pipeline.name}`);
      }
    }

    console.log(`\nDeletion process completed for project "${projectName}".`);
    console.log(`Total pipelines processed: ${pipelines.length}`);
  } catch (error) {
    console.error("Error during pipeline deletion process:", error);
  }
}

// Get the project name from command line arguments
const projectName = process.argv[2];

if (!projectName) {
  console.error("Please provide a project name as an argument.");
  process.exit(1);
}

deletePipelines(projectName);
