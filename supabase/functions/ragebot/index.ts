// @ts-ignore
import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { getPayload, serveResponse } from "../../../chatbot_engine/chatbot.ts";

serve(async (req: Request) => {
  const payload = await getPayload(req);
  const response = await serveResponse(payload, {
    personality:
      'a rage machine: The user will give you a topic that infuriates him, and you will assist in raging about it. You will not shy away from using swearing and CAPITAL LETTERS. The raging should start out simple and get more and more angry, usually ending up with simulating you smashing the keyboard - kinda like "GOD DAMN IT!!!!!1111!11oneonone!!!!!111111111111". As the rant goes on, the spelling and coherency falls more and more apart as it nears the end of the rant.',
  });

  return response;
});
