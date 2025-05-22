"use client";

import { Loader2 } from "lucide-react";
import React, { FunctionComponent, useEffect, useState } from "react";
import { getConfig } from "../../lib/utils";
import { DynamicComponentErrorBoundary } from "../custom/events/error-boundary";
import { parseComponent } from "../custom/events/loader";
import { DefaultHeader } from "./header";

type LayoutFile = {
  type: "header" | "footer";
  code: string;
  filename: string;
};

type LayoutComponent = LayoutFile & {
  component?: FunctionComponent | null;
  error?: string;
};

export function ChatLayout({ children }: { children: React.ReactNode }) {
  const [layoutComponents, setLayoutComponents] = useState<LayoutComponent[]>(
    [],
  );
  const [isRendering, setIsRendering] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const fetchLayoutComponents = async () => {
      setIsRendering(true);
      const layoutFiles = await fetchLayoutFiles();
      if (layoutFiles.length) {
        const layoutComponents = await parseLayoutComponents(layoutFiles);
        setLayoutComponents(layoutComponents);
      }
      setIsRendering(false);
    };

    fetchLayoutComponents();
  }, []);

  const handleError = (error: string) => {
    setErrors((prev) => [...prev, error]);
  };

  if (isRendering) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center overflow-hidden">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <div className="h-10 w-full bg-yellow-500">
        <h2 className="text-lg font-bold">
          Errors happened while rendering the layout:
        </h2>
        {errors.map((error) => (
          <div key={error}>{error}</div>
        ))}
      </div>

      <LayoutRenderer
        component={layoutComponents.find((c) => c.type === "header")?.component}
        onError={handleError}
        fallback={<DefaultHeader />}
      />

      {children}

      <LayoutRenderer
        component={layoutComponents.find((c) => c.type === "footer")?.component}
        onError={handleError}
      />
    </div>
  );
}

function LayoutRenderer({
  component,
  onError,
  fallback,
}: {
  component?: FunctionComponent | null;
  onError: (error: string) => void;
  fallback?: React.ReactNode;
}) {
  if (!component) return fallback;
  return (
    <DynamicComponentErrorBoundary onError={onError}>
      {React.createElement(component)}
    </DynamicComponentErrorBoundary>
  );
}

async function parseLayoutComponents(layoutFiles: LayoutFile[]) {
  const layoutComponents: LayoutComponent[] = await Promise.all(
    layoutFiles.map(async (layoutFile) => {
      const result = await parseComponent(layoutFile.code, layoutFile.filename);
      return { ...layoutFile, ...result };
    }),
  );
  return layoutComponents;
}

async function fetchLayoutFiles(): Promise<LayoutFile[]> {
  try {
    const response = await fetch(getConfig("LAYOUT_DIR"));
    const layoutFiles: LayoutFile[] = await response.json();
    return layoutFiles;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.warn("Error fetching layout files: ", errorMessage);
    return [];
  }
}
