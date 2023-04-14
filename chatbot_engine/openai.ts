// @ts-ignore
import { OpenAI } from "https://deno.land/x/openai/mod.ts";
import { ChatbotMessage } from "./chatbot.ts";

const open_ai_model = "gpt-3.5-turbo";

// Send messages to OpenAI, and get a text response.
export async function callAPI(
  messages: ChatbotMessage[]
): Promise<string | boolean> {
  // @ts-ignore
  const openAIAPIKey = Deno.env.get("OPENAI_API_KEY");
  console.log(messages);

  if (!openAIAPIKey) {
    return false;
  }

  const openai = new OpenAI(openAIAPIKey);

  const response = await openai.createChatCompletion({
    model: open_ai_model,
    messages: messages,
  });

  console.log(response?.choices);

  return response?.choices[0]?.message?.content;
}
