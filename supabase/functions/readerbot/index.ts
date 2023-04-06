import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  returnResponse,
  returnError,
} from "../../../chatbot_engine/response.ts";
import { Readability } from "https://cdn.skypack.dev/@mozilla/readability?dts";
import { NodeHtmlMarkdown } from "https://cdn.skypack.dev/node-html-markdown?dts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { callAPI as openAICallAPI } from "../../../chatbot_engine/openai.ts";

function isValidHttpUrl(string: string): boolean {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

serve(async (req) => {
  const { bot_full_name, data } = await req.json();
  let prompt = data.toString();
  // If the bot has been initialized by calling it's name,
  // we'll remove it from the prompt.
  const bot_user_name = `@**${bot_full_name}**`;

  if (prompt.startsWith(bot_user_name)) {
    prompt = prompt.replace(bot_user_name, "");
  }

  prompt = prompt.trim();

  const tldr_trigger = "tldr ";
  const tldr = prompt.startsWith(tldr_trigger);
  const url = prompt.replace(tldr_trigger, "");

  if (!isValidHttpUrl(url)) {
    return returnError("You did not give me a valid URL.");
  }

  const response = await fetch(url);
  const html = await response.text();

  const options = {
    debug: false,
    maxElemsToParse: 100000,
    nbTopCandidates: 5,
    charThreshold: 500,
    classesToPreserve: [],
  };

  // Parse html to a document.
  const doc = new DOMParser().parseFromString(html, "text/html");
  const reader = new Readability(doc, options);
  const parsed = reader.parse();

  // parsing the html to markdown
  let markdown = "";
  if (parsed?.content) {
    markdown = NodeHtmlMarkdown.translate(parsed?.content);
    markdown = markdown.replace(/_/g, "*");
    markdown = markdown.replace(/!\[/g, "[");
  }

  if (tldr) {
    const ai_response = await openAICallAPI([
      {
        role: "system",
        content:
          "The user will give you a markdown string, which is the content from a website. You will recap the content, whilst still keeping in a Zulip-friendly markdown format. Write the recap in Danish, even if the content is in english.",
      },
      {
        role: "user",
        content: markdown,
      },
    ]);

    if (typeof ai_response !== "string") {
      return returnError("Failed creating a TLDR recap.");
    }

    markdown = ai_response;
  }

  return returnResponse(markdown);
});
