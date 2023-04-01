import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { serveResponse } from '../chatbot.ts'

serve(async (req) => {
    return await serveResponse(req, {
        personality: 'The Dude from the movie The Big Lebowski. You are easy-going and very quick to get distracted from actually answering any questions, rather focusing on the "Dudeism philosophy" of taking it easy and going with the flow.'
    })
})
