import { BaseTool } from "llamaindex";
import config from "./tool_config.json";

enum ExternalTool {
	GoogleSearch = "google.GoogleSearchToolSpec",
	Wikipedia = "wikipedia.WikipediaToolSpec",
}

type ToolConfig = { [key in ExternalTool]: Record<string, any> };

export default class ToolFactory {
	private static async createTool(
		key: ExternalTool,
		options: Record<string, any>
	): Promise<BaseTool> {
		if (key === ExternalTool.Wikipedia) {
			const WikipediaTool = (await import("llamaindex")).WikipediaTool;
			const tool = new WikipediaTool();
			return tool;
		}

    // TODO: Implement GoogleSearchToolSpec

		throw new Error(`Sorry! Tool ${key} is not supported yet. Options: ${options}`);
	}

	public static async list(): Promise<BaseTool[]> {
		const tools: BaseTool[] = [];
    for (const [key, value] of Object.entries(config as ToolConfig)) {
      const tool = await ToolFactory.createTool(key as ExternalTool, value);
      tools.push(tool);
    }
		return tools;
	}
}
