export const BASE_PATH = "";

const DEFAULT_LLAMA_LOGO_URL = "/llama.png";
export const LLAMA_LOGO_URL = BASE_PATH
  ? `${BASE_PATH}/llama.png`
  : DEFAULT_LLAMA_LOGO_URL;

const DEFAULT_SCRIPT_PATH = "./config.js";
export const SCRIPT_PATH = BASE_PATH
  ? `${BASE_PATH}/config.js`
  : DEFAULT_SCRIPT_PATH;
