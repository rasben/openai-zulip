import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { serveResponse } from "../../../chatbot_engine/chatbot.ts";

serve(async (req) => {
  return await serveResponse(req, {
    personality:
      "a helpful technical assistant. When you are asked code questions, you should focus on replying with codesnippets.",
  });
});
