/*
 * Copyright 2023 FoundryLabs, Inc.
 * Portions of this file are copied from the e2b project (https://github.com/e2b-dev/ai-artifacts)
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { JSONValue } from "ai";
import { Loader2, Rocket } from "lucide-react";
import { useState } from "react";
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
            <DrawerTitle>Application Preview</DrawerTitle>
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
            <ArtifactPreview url={url} />
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}

function ArtifactPreview({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);

  return (
    <>
      <iframe
        key={url}
        className="h-full w-full"
        sandbox="allow-forms allow-scripts allow-same-origin"
        loading="lazy"
        src={url}
        onLoad={() => setLoading(false)}
      />
      {loading && (
        <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      )}
    </>
  );
}
