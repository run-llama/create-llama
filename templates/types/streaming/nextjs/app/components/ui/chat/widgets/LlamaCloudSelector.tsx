import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../select";
import { LLamaCloudProject } from "../hooks/use-config";
import { PipelineConfig } from "../hooks/use-llama-cloud";

// stringify the config to store in the select value
const toSelectValue = (llamaCloudConfig?: PipelineConfig) => {
  if (!llamaCloudConfig) return undefined;
  return JSON.stringify(llamaCloudConfig);
};

const DEFAULT_SELECT_VALUE = "default_env";

export interface LlamaCloudSelectorProps {
  projects: LLamaCloudProject[];
  setPipeline: (pipelineConfig: PipelineConfig | undefined) => void;
}

export function LlamaCloudSelector({
  projects,
  setPipeline,
}: LlamaCloudSelectorProps) {
  if (!projects.length) return null;

  const handlePipelineSelect = async (value: string) => {
    if (value === DEFAULT_SELECT_VALUE) return setPipeline(undefined);
    setPipeline(JSON.parse(value) as PipelineConfig);
  };

  return (
    <Select
      onValueChange={handlePipelineSelect}
      defaultValue={DEFAULT_SELECT_VALUE}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a pipeline" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Environment</SelectLabel>
          <SelectItem value={DEFAULT_SELECT_VALUE}>
            Use default pipeline
          </SelectItem>
        </SelectGroup>
        {projects.map((project) => (
          <SelectGroup key={project.id}>
            <SelectLabel className="capitalize">
              Project: {project.name}
            </SelectLabel>
            {project.pipelines.map((pipeline) => (
              <SelectItem
                key={pipeline.id}
                value={
                  toSelectValue({
                    project: project.name,
                    pipeline: pipeline.name,
                  })!
                }
              >
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
