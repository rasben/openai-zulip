// @ts-ignore
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import {
  getCleanPrompt,
  getPayload,
  ChatbotMessage,
} from "../../../chatbot_engine/chatbot.ts";
import { callAPI as openAICallAPI } from "../../../chatbot_engine/openai.ts";
import {
  returnError,
  returnResponse,
} from "../../../chatbot_engine/response.ts";

serve(async (req: Request) => {
  const payload = await getPayload(req);

  const prompt = getCleanPrompt(payload);

  const messages = [] as ChatbotMessage[];

  // Treat each line of the prompt as a seperate message.
  // - If the line is empty, skip it.
  // - If the line starts with 'system:', treat it as a system message.
  // - If the line starts with 'assistant:', treat it as an assistant message.
  // - Else, we treat it as a user message.
  const lines = prompt.split("\n");
  lines.forEach((line: string) => {
    let role = "user";

    if (line.startsWith("system:")) {
      role = "system";
    } else if (line.startsWith("assistant:")) {
      role = "assistant";
    }

    messages.push({
      role: role,
      content: line.replace(/^(system|assistant): /, ""),
    });
  });

  const bot_reply = await openAICallAPI(messages);

  if (typeof bot_reply !== "string") {
    return returnError("Could not get bot response.");
  }

  return await returnResponse(bot_reply);
});
