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

export function LlamaCloudSelector() {
  const { llamaCloud } = useClientConfig();
  if (!llamaCloud?.projects.length) return null;
  return (
    <Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a pipeline" />
      </SelectTrigger>
      <SelectContent>
        {llamaCloud.projects.map((project) => (
          <SelectGroup key={project.id}>
            <SelectLabel className="capitalize">
              Project: {project.name}
            </SelectLabel>
            {project.pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
