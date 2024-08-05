import { Loader2 } from "lucide-react";
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

type LLamaCloudPipeline = {
  id: string;
  name: string;
};

type LLamaCloudProject = {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  pipelines: Array<LLamaCloudPipeline>;
};

type PipelineConfig = {
  project: string; // project name
  pipeline: string; // pipeline name
};

type LlamaCloudConfig = {
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
    setConfig((prevConfig: any) => ({
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

  const handlePipelineSelect = async (value: string) => {
    setPipeline(JSON.parse(value) as PipelineConfig);
  };

  if (!config) {
    return (
      <div className="flex justify-center items-center p-3">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (!isValid(config)) {
    return (
      <p className="text-red-500">
        Invalid LlamaCloud configuration. Check console logs.
      </p>
    );
  }
  const { projects, pipeline } = config;

  return (
    <Select
      onValueChange={handlePipelineSelect}
      defaultValue={JSON.stringify(pipeline)}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a pipeline" />
      </SelectTrigger>
      <SelectContent>
        {projects!.map((project: LLamaCloudProject) => (
          <SelectGroup key={project.id}>
            <SelectLabel className="capitalize">
              Project: {project.name}
            </SelectLabel>
            {project.pipelines.map((pipeline) => (
              <SelectItem
                key={pipeline.id}
                className="last:border-b"
                value={JSON.stringify({
                  pipeline: pipeline.name,
                  project: project.name,
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

function isValid(config: LlamaCloudConfig): boolean {
  const { projects, pipeline } = config;
  if (!projects?.length) return false;
  if (!pipeline) return false;
  const matchedProject = projects.find(
    (project: LLamaCloudProject) => project.name === pipeline.project,
  );
  if (!matchedProject) {
    console.error(
      `LlamaCloud project ${pipeline.project} not found. Check LLAMA_CLOUD_PROJECT_NAME variable`,
    );
    return false;
  }
  const pipelineExists = matchedProject.pipelines.some(
    (p) => p.name === pipeline.pipeline,
  );
  if (!pipelineExists) {
    console.error(
      `LlamaCloud pipeline ${pipeline.pipeline} not found. Check LLAMA_CLOUD_INDEX_NAME variable`,
    );
    return false;
  }
  return true;
}
