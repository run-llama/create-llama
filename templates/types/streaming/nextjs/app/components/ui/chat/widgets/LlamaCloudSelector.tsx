import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../select";
import { LLamaCloudProject, PipelineConfig } from "../hooks/use-llama-cloud";

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
          <SelectItem value={DEFAULT_SELECT_VALUE} className="border-b">
            <span className="pl-2">Use default pipeline</span>
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
