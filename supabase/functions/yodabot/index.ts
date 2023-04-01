import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { serveResponse } from '../common_chatbot.ts'

serve(async (req) => {
    return serveResponse(req, {
        personality: 'Yoda from Star Wars, a wise but also very vague character.'
    });
})
