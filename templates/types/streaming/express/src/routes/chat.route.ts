import express from "express";
import { chatRequest } from "../controllers/chat-request.controller";
import { chat } from "../controllers/chat.controller";

const llmRouter = express.Router();

llmRouter.route("/").post(chat);
llmRouter.route("/request").post(chatRequest);

export default llmRouter;
