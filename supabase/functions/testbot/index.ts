// @ts-ignore
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { getPayload, serveResponse } from "../../../chatbot_engine/chatbot.ts";

// A simple bot that only replies with "ok"
// Used by the test suite to verify that the chatbot engine is working.
serve(async (req: Request) => {
  const payload = await getPayload(req);

  return await serveResponse(payload, {
    personality:
      'a machine that can ONLY reply with "ok" - no answers, no questions, no punctuation, no whitespaces, no nothing. You will only be able to reply with "ok" to any message.',
  });
});
