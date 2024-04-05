import express, { Router } from "express";
import { chatRequest } from "../controllers/chat-request.controller";
import { chat } from "../controllers/chat.controller";
import { initSettings } from "../controllers/engine/settings";

const llmRouter: Router = express.Router();

initSettings();
llmRouter.route("/").post(chat);
llmRouter.route("/request").post(chatRequest);

export default llmRouter;
