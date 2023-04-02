import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { serveResponse } from "../../../chatbot_engine/chatbot.ts";

serve(async (req) => {
  return await serveResponse(req, {
    personality: "Yoda from Star Wars, a wise but also very vague character.",
  });
});
