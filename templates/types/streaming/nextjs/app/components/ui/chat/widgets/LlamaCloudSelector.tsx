import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../select";
import { RequestData } from "../chat-input";
import { useClientConfig } from "../hooks/use-config";

export type LLamaCloudProject = {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  pipelines: Array<{
    id: string;
    name: string;
  }>;
};

export type PipelineConfig = {
  project: string; // project name
  pipeline: string; // pipeline name
};

export type LlamaCloudConfig = {
  projects?: LLamaCloudProject[];
};

export interface LlamaCloudSelectorProps {
  requestData: RequestData | undefined;
  setRequestData: (requestData: RequestData | undefined) => void;
}

export function LlamaCloudSelector({
  requestData,
  setRequestData,
}: LlamaCloudSelectorProps) {
  const { backend } = useClientConfig();
  const [config, setConfig] = useState<LlamaCloudConfig>();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_LLAMACLOUD === "true" && !config) {
      fetch(`${backend}/api/chat/config/llamacloud`)
        .then((response) => response.json())
        .then((data) => {
          setConfig(data);
          setRequestData({
            ...requestData,
            llamaCloudPipeline: data.pipeline,
          });
        })
        .catch((error) => console.error("Error fetching config", error));
    }
  }, [backend, config, requestData, setRequestData]);

  const setPipeline = (pipelineConfig?: PipelineConfig) => {
    setRequestData({
      ...requestData,
      llamaCloudPipeline: pipelineConfig,
    });
  };

  const projects = config?.projects;
  if (!projects?.length) return null;

  const handlePipelineSelect = async (value: string) => {
    setPipeline(JSON.parse(value) as PipelineConfig);
  };

  const pipeline = requestData?.llamaCloudPipeline;

  return (
    <Select
      onValueChange={handlePipelineSelect}
      defaultValue={
        pipeline
          ? JSON.stringify({
              project: pipeline.project,
              pipeline: pipeline.pipeline,
            })
          : undefined
      }
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a pipeline" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectGroup key={project.id}>
            <SelectLabel className="capitalize">
              Project: {project.name}
            </SelectLabel>
            {project.pipelines.map((pipeline) => (
              <SelectItem
                key={pipeline.id}
                className="last:border-b"
                value={JSON.stringify({
                  project: project.name,
                  pipeline: pipeline.name,
                })}
              >
                <span className="pl-2">{pipeline.name}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
