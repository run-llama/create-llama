import { agent, multiAgent } from "llamaindex";

import { documentGenerator, wiki } from "@llamaindex/tools";

const reportAgent = agent({
  name: "ReportAgent",
  description:
    "Responsible for crafting well-written blog posts based on research findings",
  systemPrompt: `You are a professional writer. Your task is to create an engaging blog post using the research content provided. Once complete, save the post to a file using the document_generator tool.`,
  tools: [
    documentGenerator({
      outputDir: "output/tools",
      fileServerURLPrefix: "/api/files",
    }),
  ],
});

const researchAgent = agent({
  name: "ResearchAgent",
  description:
    "Responsible for gathering relevant information from the internet",
  systemPrompt: `You are a research agent. Your role is to gather information from the internet using the provided tools and then transfer this information to the report agent for content creation.`,
  tools: [wiki()],
  canHandoffTo: [reportAgent],
});

export const workflowFactory = () =>
  multiAgent({
    agents: [researchAgent, reportAgent],
    rootAgent: researchAgent,
  });
