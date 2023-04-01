import {
    supabase,
    commands
} from './shared.ts'

import { 
    detectAndHandleChange as detectAndHandleConsentChange,
    updateInfo as updateConsentInfo,
    basicCheck as basicConsentCheck,
    fullCheck as fullConsentCheck,
    info as consentInfo,
} from './consent.ts'

import {
    callAPI as openAICallAPI,
} from './openai.ts'

// Helper, for returning a Response in a format that Zulip understands.
async function returnResponse(message: string, status: number = 200) {
    return new Response(
        JSON.stringify({
            'content': message,
        }),
        {
            headers: { "Content-Type": "application/json" },
            status: status
        },
    )
}

// Helper function for returning an error response.
async function returnError(message: string) {
    console.error(message)
    return returnResponse(`Error: ${message}`, 400)
}

// Clean up the prompt string, such as removing the bot call name.
function getCleanPrompt(prompt: string, bot_name: string) {
    // If the bot has been initialized by calling it's name,
    // we'll remove it from the prompt.
    const bot_user_name = `@**${bot_name}**`

    if (prompt.startsWith(bot_user_name)) {
        prompt = prompt.replace(bot_user_name, "")
    }

    prompt = prompt.trim()

    return prompt
}

// Load a specific chat summary from Supabase DB.
async function getChatSummary(summary_id: string) {
    const { data, error } = await supabase
        .from('summaries')
        .select('summary')
        .eq('id', summary_id)

    if (error) {
        console.error(error)
    }

    if (!data?.length) {
        return ''
    }

    return data[0].summary ?? ''
}

// Save a chat summary to Supabase DB.
async function setChatSummary(vars: any) {
    if (vars.bot_reply) {
        vars.messages.push({
            "role": "assistant",
            "content": vars.bot_reply,
        })    
    }

    vars.messages.push({
        "role": "system",
        "content": "Create a short but precise recap of your chat with the user up until now.",
    })

    const summary = await openAICallAPI(vars.messages)

    const { data, error } = await supabase
        .from('summaries')
        .upsert({
            id: vars.summary_id,
            user_id: vars.user_id,
            bot_id: vars.bot_id,
            summary: summary
        }, { onConflict: 'id' })

    if (error) {
        console.error(error)
    }

    return data
}

// Build the variables for processing the chatbot.
async function buildVariables(
    req: any, 
    options: any
) {
    const { bot_full_name, data, message } = await req.json()

    const user_name = message?.sender_full_name

    // Removing any whitespaces, symbols etc. from the bot name.
    const bot_id = bot_full_name.replace(/\W/g, '')

    let messages = options?.messages ?? []

    if (options.hasOwnProperty('personality')) {
        messages.push({
            "role": "system",
            "content": "You are taking the personality of " + options['personality']
        })
    }

    messages.push({
        "role": "system",
        "content": "IMPORTANT: by default you will answer in Danish."
    })

    // If the user has not given GDPR consent, break out with a prompt for consent.
    const user_id = message?.sender_id

    let prompt = data.toString()

    prompt = getCleanPrompt(prompt, bot_full_name)

    // We want to save summaries pr user, pr stream:
    // AKA: If the user says they like hamburgers in #lounge, the bot wont
    // remember it in #random.
    const stream_id = message?.stream_id
    const summary_id = `${bot_id}-${stream_id}-${user_id}`

    return {
        user_name: user_name,
        user_id: user_id,
        bot_id: bot_id,
        prompt: prompt,
        messages: messages,
        summary_id: summary_id,
        // These options will be set further down the code.
        user_message: {},
        bot_reply: ''
    }

}

// Endpoint used by the bots - serving the response that Zulip understands.
export async function serveResponse(
    req: any,
    options: any
) {
    const vars = await buildVariables(req, options)

    // Checking if the users prompt is one of the consent-change keywords.
    if (await detectAndHandleConsentChange(vars.user_id, vars.prompt)) {
        return await returnResponse(await updateConsentInfo())
    }

    // If the user wants to see the chat history, we'll return that.
    if (vars.prompt === commands.show_history) {
        return await returnResponse(await getChatSummary(vars.summary_id))
    }

    // If the user has not given consent, we'll return a prompt for consent.
    if (!await basicConsentCheck(vars.user_id)) {
        return returnResponse(await consentInfo(vars.messages))
    }

    const hasFullConsent = await fullConsentCheck(vars.user_id)

    // If the user has given full consent, we'll load any previous chat history.
    if (hasFullConsent) {
       const summary = await getChatSummary(vars.summary_id)

       if (summary) {
           vars.messages.push({
               "role": "system",
               "content": `Recap of conversation history with this user: ${summary}`
           })
       }
    }

    // Add the user message to the messages array, so the bot can use it.
    const user_message = {
        "role": "user",
        "content": `${vars.user_name}: ${vars.prompt}`
    }

    vars.messages.push(user_message)
    vars.user_message = user_message

    // Calling the OpenAI API to get a response.
    const bot_reply = await openAICallAPI(vars.messages)

    if (!bot_reply) {
        return returnError('Could not get bot response.')
    }

    vars.bot_reply = bot_reply

    // If the user has given full consent, we'll recreate a chat summary,
    // and save it to Supabase DB.
    if (hasFullConsent) {
        await setChatSummary(vars)
    }

    return await returnResponse(bot_reply)
}
