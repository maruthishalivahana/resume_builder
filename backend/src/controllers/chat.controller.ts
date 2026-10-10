import { NextFunction, Request, Response } from "express";
import { ChatService } from "../services/chat.service";

const chatService = new ChatService();

export async function handleChat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message, history, projectId } = req.body || {};
    const result = await chatService.processChat({ message, history, projectId });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
