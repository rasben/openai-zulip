import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  serveResponse,
  getCleanPrompt,
} from "../../../chatbot_engine/chatbot.ts";

serve(async (req) => {
  const { bot_full_name, data } = await req.json();

  let prompt = data.toString();

  prompt = getCleanPrompt(prompt, bot_full_name);

  const messages = [] as any[];

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

  return await serveResponse(req, {
    messages: messages,
  });
});
