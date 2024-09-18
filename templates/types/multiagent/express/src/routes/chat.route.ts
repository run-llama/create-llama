import express, { Router } from "express";
import { chatConfig } from "../controllers/chat-config.controller";
import { chat } from "../controllers/chat.controller";
import { initSettings } from "../controllers/engine/settings";

const llmRouter: Router = express.Router();

initSettings();
llmRouter.route("/").post(chat);
llmRouter.route("/config").get(chatConfig);

export default llmRouter;
