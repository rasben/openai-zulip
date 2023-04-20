// @ts-ignore
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";

// @ts-ignore
import { getPayload, getCleanPrompt } from "../../../chatbot_engine/chatbot.ts";
import {
  returnResponse,
  returnError,
  // @ts-ignore
} from "../../../chatbot_engine/response.ts";

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Init'ing the supabase CLI - this time using the forlang project.
// https://github.com/rasben/forlang
export const supabaseForlang = createClient(
  // @ts-ignore
  Deno.env.get("SUPABASE_FORLANG_URL") ?? "",
  // @ts-ignore
  Deno.env.get("SUPABASE_FORLANG_ANON_KEY") ?? ""
);

export interface ReadabilityParsed {
  title: string;
  content?: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline: string;
  dir: string;
  siteName: string;
  lang: string;
}

export interface PageContent extends ReadabilityParsed {
  url: URL;
  hash: string;
  readonly type: "PageContent";
}

export interface ResponsePayload {
  content: string;
  page_content?: PageContent;
}

function isValidHttpUrl(string: string): boolean {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

serve(async (req: Request) => {
  const payload = await getPayload(req);

  const prompt = getCleanPrompt(payload);

  const tldrTrigger = "tldr ";
  const url = prompt.replace(tldrTrigger, "");

  if (!isValidHttpUrl(url)) {
    return returnError("You did not give me a valid URL.");
  }

  // Let's just always use the enshorter function for now.
  const tldr = true;
  const functionName = tldr ? "enshorter" : "reader";

  const { data, error } = await supabaseForlang.functions.invoke(functionName, {
    body: { url: url },
  });

  if (error) {
    return returnResponse(
      "Der skete en fejl :( Prøv igen - så skulle det gerne virke."
    );
  }

  const responsePayload = data as ResponsePayload;

  let textContent = responsePayload?.content;
  const pageContent = responsePayload?.page_content;

  // Find all sentences (./!/? [capital letter]) and add a new line.
  textContent = textContent.replace(/([.!?])\s*(?=[A-Z])/g, "$1\r\n\r\n");

  let markdown = `
**${pageContent?.title}**

${textContent}

*${pageContent?.byline}*

\r\n*original længde: ${pageContent?.length} tegn*
  `;

  // Zulip uses a weird zulip-version of markdown.
  markdown = markdown.replace(/_/g, "*");
  markdown = markdown.replace(/!\[/g, "[");

  return returnResponse(markdown);
});
