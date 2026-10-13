import { z } from "zod";

export const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"], { message: "Client messages cannot set the system role." }),
  content: z.string().trim().min(1, "Message content cannot be empty.").max(50_000, "Message is too long."),
});

export const chatRequestSchema = z
  .object({
    messages: z.array(conversationMessageSchema).min(1, "At least one message is required.").max(50, "Conversation exceeds maximum history depth."),
    stream: z.boolean().optional().default(false),
    style: z.enum(["default", "concise", "detailed", "code"]).optional(),
    customSystemPrompt: z.string().max(2000, "Custom instructions cannot exceed 2000 characters.").optional(),
    language: z.string().trim().min(2).max(80).optional().default("English"),
    temperature: z.number().min(0).max(2).optional(),
    guestMode: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    const total = value.messages.reduce((sum, message) => sum + message.content.length, 0);
    if (total > 150_000) {
      context.addIssue({ code: "custom", message: "Conversation total content exceeds maximum character limit." });
    }
    if (!value.messages.some((message) => message.role === "user")) {
      context.addIssue({ code: "custom", message: "At least one user message is required." });
    }
  });

export const composerSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(12_000, "That message is too long."),
});

export type ComposerValues = z.infer<typeof composerSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
