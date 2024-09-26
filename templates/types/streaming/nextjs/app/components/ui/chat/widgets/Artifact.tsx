import { JSONValue } from "ai";
import { Rocket } from "lucide-react";
import { Button } from "../../button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../../drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../tabs";
import Markdown from "../chat-message/markdown";

type Artifact = {
  commentary: string;
  template: string;
  title: string;
  description: string;
  additional_dependencies: string[];
  has_additional_dependencies: boolean;
  install_dependencies_command: string;
  port: number | null;
  file_path: string;
  code: string;
};

type ArtifactProps = {
  artifact?: Artifact;
  url?: string;
};

export function Artifact({ data }: { data: JSONValue }) {
  const { artifact, url } = data as ArtifactProps;
  if (!artifact || !url) return null;

  const fileExtension = artifact.file_path.split(".").pop();
  const markdownCode = `\`\`\`${fileExtension}\n${artifact.code}\n\`\`\``;

  return (
    <Drawer direction="left">
      <DrawerTrigger asChild>
        <Button className="w-max">
          View Demo <Rocket className="ml-2 h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-3/5 mt-24 h-full max-h-[96%] ">
        <DrawerHeader className="flex justify-between">
          <div className="space-y-2">
            <DrawerTitle>Artifact Preview</DrawerTitle>
            <DrawerDescription>
              Open in your brower:{" "}
              <a href={url} target="_blank" className="text-blue-500">
                {url}
              </a>
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerHeader>
        <Tabs defaultValue="code" className="h-full p-4 overflow-auto">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="code" className="h-full">
            <div className="m-4 overflow-auto">
              <Markdown content={markdownCode} />
            </div>
          </TabsContent>
          <TabsContent value="preview" className="h-full">
            <iframe
              key={url}
              className="h-full w-full"
              sandbox="allow-forms allow-scripts allow-same-origin"
              loading="lazy"
              src={url}
            />
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
