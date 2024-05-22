/* Function to conditionally load the global-agent/bootstrap module */
export async function initializeGlobalAgent() {
  if (process.env.GLOBAL_AGENT_HTTP_PROXY) {
    /* Dynamically import global-agent/bootstrap */
    await import("global-agent/bootstrap");
    console.log("Proxy enabled via global-agent.");
  }
}
