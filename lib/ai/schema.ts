import { z } from "zod";

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(50_000),
});

export const chatRequestSchema = z.object({
  messages: z.array(conversationMessageSchema).min(1).max(40),
}).superRefine((value, context) => {
  const total = value.messages.reduce((sum, message) => sum + message.content.length, 0);
  if (total > 120_000) context.addIssue({ code: "custom", message: "Conversation is too long." });
  if (!value.messages.some((message) => message.role === "user")) {
    context.addIssue({ code: "custom", message: "At least one user message is required." });
  }
});

export const composerSchema = z.object({
  message: z.string().trim().min(1, "Write a message first.").max(8_000, "That message is too long."),
});
export type ComposerValues = z.infer<typeof composerSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
