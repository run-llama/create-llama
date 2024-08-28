import {
  BaseNodePostprocessor,
  MessageContent,
  NodeWithScore,
} from "llamaindex";

class NodeCitationProcessor implements BaseNodePostprocessor {
  /**
   * Append node_id into metadata for citation purpose.
   * Config SYSTEM_CITATION_PROMPT in your runtime environment variable to enable this feature.
   */
  async postprocessNodes(
    nodes: NodeWithScore[],
    query?: MessageContent,
  ): Promise<NodeWithScore[]> {
    for (const nodeScore of nodes) {
      if (!nodeScore.node || !nodeScore.node.metadata) {
        continue; // Skip nodes with missing properties
      }
      nodeScore.node.metadata["node_id"] = nodeScore.node.id_;
    }
    return nodes;
  }
}

export const nodeCitationProcessor = new NodeCitationProcessor();
