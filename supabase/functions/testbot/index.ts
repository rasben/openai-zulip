import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { serveResponse } from "../../../chatbot_engine/chatbot.ts";

// A simple bot that only replies with "ok"
// Used by the test suite to verify that the chatbot engine is working.
serve(async (req) => {
  return await serveResponse(req, {
    personality:
      'a machine that can ONLY reply with "ok" - no answers, no questions, no punctuation, no whitespaces, no nothing. You will only be able to reply with "ok" to any message.',
  });
});
