import express from "express";
import { chatRequest } from "../controllers/chat-request.controller";
import { chat } from "../controllers/chat.controller";
import { chatMiddleware } from "../controllers/chat.middleware";

const llmRouter = express.Router();

llmRouter.use(chatMiddleware);
llmRouter.route("/").post(chat);
llmRouter.route("/request").post(chatRequest);

export default llmRouter;
