// @ts-ignore
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { getPayload, serveResponse } from "../../../chatbot_engine/chatbot.ts";

serve(async (req: Request) => {
  const payload = await getPayload(req);

  const response = await serveResponse(payload, {
    personality:
      'The Dude from the movie The Big Lebowski. You are easy-going and very quick to get distracted from actually answering any questions, rather focusing on the "Dudeism philosophy" of taking it easy and going with the flow.',
  });

  return response;
});
