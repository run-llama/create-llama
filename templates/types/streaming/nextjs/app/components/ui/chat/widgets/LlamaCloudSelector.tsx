import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../select";
import { LlamaCloudConfig, useClientConfig } from "../hooks/use-config";

// stringify the config to store in the select value
const toSelectValue = (llamaCloudConfig?: LlamaCloudConfig) => {
  if (!llamaCloudConfig) return undefined;
  return JSON.stringify(llamaCloudConfig);
};

export function LlamaCloudSelector() {
  const { llamaCloud, updateLlamaCloudConfig } = useClientConfig({
    shouldFetchConfig: true,
  });
  if (!llamaCloud?.projects.length) return null;

  const handlePipelineSelect = async (value: string) => {
    try {
      const { project, pipeline } = JSON.parse(value) as LlamaCloudConfig;
      await updateLlamaCloudConfig({ project, pipeline });
    } catch (error) {
      console.error("Failed to update LlamaCloud config", error);
    }
  };

  return (
    <Select
      onValueChange={handlePipelineSelect}
      defaultValue={toSelectValue(llamaCloud.config)}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Default " />
      </SelectTrigger>
      <SelectContent>
        {llamaCloud.projects.map((project) => (
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
