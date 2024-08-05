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
  pipeline?: PipelineConfig;
};

export interface LlamaCloudSelectorProps {
  setRequestData: React.Dispatch<any>;
}

export function LlamaCloudSelector({
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
            llamaCloudPipeline: data.pipeline,
          });
        })
        .catch((error) => console.error("Error fetching config", error));
    }
  }, [backend, config, setRequestData]);

  const setPipeline = (pipelineConfig?: PipelineConfig) => {
    setConfig((prevConfig) => ({
      ...prevConfig,
      pipeline: pipelineConfig,
    }));
    setRequestData((prevData: any) => {
      if (!prevData) return { llamaCloudPipeline: pipelineConfig };
      return {
        ...prevData,
        llamaCloudPipeline: pipelineConfig,
      };
    });
  };

  const { projects, pipeline } = config ?? {};
  if (!projects?.length) return null;

  const handlePipelineSelect = async (value: string) => {
    setPipeline(JSON.parse(value) as PipelineConfig);
  };

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
