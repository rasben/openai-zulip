// @ts-ignore
import { Response } from "https://deno.land/std@0.183.0/http/server.ts";

import { supabase, commands } from "./shared.ts";

import {
  detectAndHandleChange as detectAndHandleConsentChange,
  updateInfo as updateConsentInfo,
  basicCheck as basicConsentCheck,
  fullCheck as fullConsentCheck,
  info as consentInfo,
} from "./consent.ts";

import { callAPI as openAICallAPI } from "./openai.ts";
import { returnResponse, returnError } from "./response.ts";

export interface ChatbotMessage {
  role: string;
  content: string;
}

export interface ChatbotPayload {
  bot_full_name: string;
  data: string;
  message?: {
    sender_full_name?: string;
    sender_id?: number;
    stream_id?: number;
  };
}

export interface ChatbotVariables {
  user_name?: string;
  user_id: number;
  bot_id: string;
  prompt?: string;
  messages: ChatbotMessage[];
  summary_id?: string;
  user_message?: ChatbotMessage;
  bot_reply?: string;
}

interface ChatbotOptions {
  messages?: ChatbotMessage[];
  personality?: string;
}

// Clean up the prompt string, such as removing the bot call name.
export function getCleanPrompt(payload: ChatbotPayload) {
  let prompt = payload?.data.toString();

  // If the bot has been initialized by calling it's name,
  // we'll remove it from the prompt.
  const bot_user_name = `@**${payload?.bot_full_name}**`;

  if (prompt.startsWith(bot_user_name)) {
    prompt = prompt.replace(bot_user_name, "");
  }

  prompt = prompt.trim();

  return prompt;
}

// Load a specific chat summary from Supabase DB.
async function getChatSummary(summary_id: string): Promise<string> {
  const { data, error } = await supabase
    .from("summaries")
    .select("summary")
    .eq("id", summary_id);

  if (error) {
    console.error(error);
  }

  if (!data?.length) {
    return "";
  }

  return data[0].summary ?? "";
}

// Save a chat summary to Supabase DB.
async function setChatSummary(vars: ChatbotVariables): Promise<void> {
  if (vars.bot_reply) {
    vars.messages.push({
      role: "assistant",
      content: vars.bot_reply ?? "",
    });
  }

  vars.messages.push({
    role: "system",
    content:
      "Create a short but precise recap of your chat with the user up until now.",
  });

  const summary = await openAICallAPI(vars.messages);

  const { error } = await supabase.from("summaries").upsert(
    {
      id: vars.summary_id,
      user_id: vars.user_id,
      bot_id: vars.bot_id,
      summary: summary,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error(error);
  }
}

export async function getPayload(req: Request): Promise<ChatbotPayload> {
  const { bot_full_name, data, message } = await req.json();

  return { bot_full_name, data, message };
}

// Build the variables for processing the chatbot.
function buildVariables(
  payload: ChatbotPayload,
  options: ChatbotOptions
): ChatbotVariables {
  const user_name = payload?.message?.sender_full_name;

  // Removing any whitespaces, symbols etc. from the bot name.
  const bot_id = payload?.bot_full_name.replace(/\W/g, "");

  const messages = [];

  if ("personality" in options) {
    messages.push({
      role: "system",
      content: "You are taking the personality of " + options["personality"],
    });
  }

  messages.push({
    role: "system",
    content: "IMPORTANT: by default you will answer in Danish.",
  });

  // If the user has not given GDPR consent, break out with a prompt for consent.
  const user_id = payload?.message?.sender_id;

  const prompt = getCleanPrompt(payload);

  // We want to save summaries pr user, pr stream:
  // AKA: If the user says they like hamburgers in #lounge, the bot wont
  // remember it in #random.
  const stream_id = payload?.message?.stream_id;
  const summary_id = `${bot_id}-${stream_id}-${user_id}`;

  return {
    user_name: user_name,
    user_id: user_id ?? 0,
    bot_id: bot_id,
    prompt: prompt,
    messages: messages,
    summary_id: summary_id,
  };
}

// Endpoint used by the bots - serving the response that Zulip understands.
export async function serveResponse(
  payload: ChatbotPayload,
  options: ChatbotOptions
): Promise<Response> {
  const vars = buildVariables(payload, options);

  // Checking if the users prompt is one of the consent-change keywords.
  if (await detectAndHandleConsentChange(vars.user_id, vars.prompt ?? "")) {
    return await returnResponse(updateConsentInfo());
  }

  // If the user wants to see the chat history, we'll return that.
  if (vars.prompt === commands.show_history) {
    return await returnResponse(await getChatSummary(vars?.summary_id ?? ""));
  }

  // If the user has not given consent, we'll return a prompt for consent.
  if (!(await basicConsentCheck(vars.user_id))) {
    return returnResponse(consentInfo());
  }

  const hasFullConsent = await fullConsentCheck(vars?.user_id ?? 0);

  // If the user has given full consent, we'll load any previous chat history.
  if (hasFullConsent) {
    const summary = await getChatSummary(vars?.summary_id ?? "");

    if (summary) {
      vars.messages.push({
        role: "system",
        content: `Recap of conversation history with this user: ${summary}`,
      });
    }
  }

  // Add the user message to the messages array, so the bot can use it.
  const user_message = {
    role: "user",
    content: `${vars.user_name}: ${vars.prompt}`,
  };

  vars.messages.push(user_message);
  vars.user_message = user_message;

  // Calling the OpenAI API to get a response.
  const bot_reply = await openAICallAPI(vars.messages);

  if (typeof bot_reply !== "string") {
    return returnError("Could not get bot response.");
  }

  vars.bot_reply = bot_reply;

  // If the user has given full consent, we'll recreate a chat summary,
  // and save it to Supabase DB.
  if (hasFullConsent) {
    await setChatSummary(vars);
  }

  return await returnResponse(bot_reply);
}
