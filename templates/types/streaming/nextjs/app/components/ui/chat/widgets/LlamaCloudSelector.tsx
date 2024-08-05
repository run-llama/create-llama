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

export interface LlamaCloudSelectorProps {
  projects: LLamaCloudProject[];
  pipeline: PipelineConfig | undefined;
  setPipeline: (pipelineConfig: PipelineConfig | undefined) => void;
}

export function LlamaCloudSelector({
  projects,
  pipeline,
  setPipeline,
}: LlamaCloudSelectorProps) {
  if (!projects.length) return null;

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
