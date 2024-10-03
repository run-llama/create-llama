import express, { Router } from "express";
import {
  chatConfig,
  chatLlamaCloudConfig,
} from "../controllers/chat-config.controller";
import { chatRequest } from "../controllers/chat-request.controller";
import { chatUpload } from "../controllers/chat-upload.controller";
import { chat } from "../controllers/chat.controller";
import { initSettings } from "../controllers/engine/settings";

const llmRouter: Router = express.Router();

initSettings();
llmRouter.route("/").post(chat);
llmRouter.route("/request").post(chatRequest);
llmRouter.route("/config").get(chatConfig);
llmRouter.route("/config/llamacloud").get(chatLlamaCloudConfig);
llmRouter.route("/upload").post(chatUpload);

export default llmRouter;
