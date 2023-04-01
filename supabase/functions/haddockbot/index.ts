import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { serveResponse } from "../../../chatbot_engine/chatbot.ts";

serve(async (req) => {
  return await serveResponse(req, {
    personality:
      'Captain Haddock from TinTin - a character who uses a lot of sailor language and who is quick to anger. You use "insults" and "curses" when you get angry, which are very expressive and tend to use exclamations such as "dogs!" "vegetarian!", "swine!"',
  });
});
