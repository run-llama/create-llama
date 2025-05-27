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
    const loadLayout = async () => {
      setIsRendering(true);
      const layoutFiles = await fetchLayoutFiles();
      if (layoutFiles.length) {
        const layoutComponents = await parseLayoutComponents(layoutFiles);
        setLayoutComponents(layoutComponents);
        setErrors((errors) => [
          ...errors,
          ...(layoutComponents.map((c) => c.error).filter(Boolean) as string[]),
        ]);
      }
      setIsRendering(false);
    };

    loadLayout();
  }, []);

  const handleError = (error: string) => {
    setErrors((prev) => [...prev, error]);
  };

  const getLayoutCode = (type: "header" | "footer") => {
    return layoutComponents.find((c) => c.type === type)?.component;
  };

  if (isRendering) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center overflow-hidden">
        <Loader2 className="text-muted-foreground animate-spin" />
      </div>
    );
  }

  const uniqueErrors = [...new Set(errors)];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {uniqueErrors.length > 0 && (
        <div className="w-full bg-yellow-100 px-4 py-2 text-black/70">
          <h2 className="mb-2 font-semibold">
            Errors happened while rendering the layout:
          </h2>
          {uniqueErrors.map((error) => (
            <div key={error} className="text-sm">
              {error}
            </div>
          ))}
        </div>
      )}

      <LayoutRenderer
        component={getLayoutCode("header")}
        onError={handleError}
        fallback={<DefaultHeader />}
      />

      {children}

      <LayoutRenderer
        component={getLayoutCode("footer")}
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
    <DynamicComponentErrorBoundary onError={onError} fallback={fallback}>
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
    const layoutApi = getConfig("LAYOUT_API");
    if (!layoutApi) return [];
    const response = await fetch(layoutApi);
    const layoutFiles: LayoutFile[] = await response.json();
    return layoutFiles;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.warn("Error fetching layout files: ", errorMessage);
    return [];
  }
}
