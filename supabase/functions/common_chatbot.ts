import { OpenAI } from "https://deno.land/x/openai/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const open_ai_model = 'gpt-3.5-turbo';

// Init'ing the supabase CLI.
const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
)

// The various consent types, along with their key-phrases.
const commands = {
    'basic_consent': 'tjoh',
    'full_consent': 'ok',
    'remove_consent': 'delete',
    'show_history': 'history'
};

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

// Checking if the current user has already given a type of consent.
async function consentCheck(
    user_id: number,
    consent_type: string
) {
    const { data, error } = await supabase
        .from('users')
        .select(consent_type)
        .eq(consent_type, true)
        .eq('id', user_id);

    if (error) {
        console.error(error);
    }

    // If the user has not given consent, we'll return false.
    return (data && data?.length !== 0);
}

// Has the user given basic consent?
async function basicConsentCheck(user_id: number) {
    return consentCheck(user_id, 'basic_consent');
}

// Has the user given full consent?
async function fullConsentCheck(user_id: number) {
    return consentCheck(user_id, 'full_consent');
}


async function consentUpdate(
    user_id: number,
    basic: boolean,
    full: boolean
) {
    const { data, error } = await supabase
        .from('users')
        .upsert({
            id: user_id,
            basic_consent: basic,
            full_consent: full,
        }, { onConflict: 'id' });

    if (error) {
        console.error(error);
    }
}

async function removeUser(user_id: number) {
    const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', user_id)

    if (error) {
        console.error(error);
    }
}
// Check if the user has requested a consent change, with a command keyword.
async function consentChangeCheck(user_id: number, prompt: string) {
    let change = false;

    switch (prompt) {
        // The user has agreed to the basic terms, and we will not store chat history.
        case commands.basic_consent:
            await consentUpdate(user_id, true, false);
            change = true;
            break;

        // The user has agreed to all data terms.
        case commands.full_consent:
            await consentUpdate(user_id, true, true);
            change = true;
            break;

        // The user wants to have data deleted, and consent revoked.
        case commands.remove_consent:
            await removeUser(user_id);
            change = true;
            break;
    }

    return change;
}

// The user has not given GDPR consent.
// We'll need to get them to accept, before we log any data about them,
// or send any information to OpenAI.
// Let's just use ChatGPT to create a friendly message, in the style of the
// bot - as long as we dont tell the bot anything about the user,
// or their message it's all good.
async function consentPrompt(messages: any) {
    messages.push({
        "role": "system",
        "content": `
            Inform the user in clear terms that: 
                1) If they want to use this bot, they need to accept that their username, email and message 
                    will be sent outside EU (Supabase & OpenAI) 
                2) They can choose that the bot also stories a summary of their messages, to better respond in the future. 
                    This data is stored in plaintext, visible for the bot-maintainer (Benji) 
                3) None of their data nor message has been logged yet`
    });

    let response = await messageAI(messages);

    response = `${response}\r\n\r\n
Giv venligst samtykke: \r\n
- \`${commands.full_consent}\` for at acceptere \r\n
- \`${commands.basic_consent}\` for at acceptere basalt brug UDEN at slå chat-historik til`

    return returnResponse(response);
}

// Send messages to OpenAI, and get a text response.
async function messageAI(messages: any) {
    const openAIAPIKey = Deno.env.get('OPENAI_API_KEY')

    if (!openAIAPIKey) {
        return false;
    }

    const openai = new OpenAI(openAIAPIKey);

    const response = await openai.createChatCompletion({
        model: open_ai_model,
        messages: messages
    });

    return response?.choices[0]?.message?.content;
}

// Helper function for returning an error response.
async function returnError(message: string) {
    console.error(message);
    return returnResponse(`Error: ${message}`, 400);
}

// Clean up the prompt string, such as removing the bot call name.
function getCleanPrompt(prompt: string, bot_name: string) {
    // If the bot has been initialized by calling it's name,
    // we'll remove it from the prompt.
    const bot_user_name = `@**${bot_name}**`;

    if (prompt.startsWith(bot_user_name)) {
        prompt = prompt.replace(bot_user_name, "")
    }

    prompt = prompt.trim();

    return prompt;
}

// Load a specific chat summary from Supabase DB.
async function getChatSummary(summary_id: string) {
    const { data, error } = await supabase
        .from('summaries')
        .select('summary')
        .eq('id', summary_id);

    if (error) {
        console.error(error);
    }

    if (!data?.length) {
        return '';
    }

    return data[0].summary ?? '';
}

// Save a chat summary to Supabase DB.
async function setChatSummary(summary_id: string, user_id: number, bot_id: string, messages: any, bot_response: string) {
    messages.push({
        "role": "assistant",
        "content": bot_response,
    })

    messages.push({
        "role": "system",
        "content": "Create a short but precise recap of your chat with the user up until now.",
    })

    const summary = await messageAI(messages);

    const { data, error } = await supabase
        .from('summaries')
        .upsert({
            id: summary_id,
            user_id: user_id,
            bot_id: bot_id,
            summary: summary
        }, { onConflict: 'id' });

    if (error) {
        console.error(error);
    }

    return data;
}

// Endpoint used by the bots - serving the response that Zulip understands.
export async function serveResponse(
    req: any,
    options: any
) {
    const { bot_full_name, data, message } = await req.json()

    // Removing any whitespaces, symbols etc. from the bot name.
    const bot_id = bot_full_name.replace(/\W/g, '')

    let messages = options?.messages ?? [];

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
    const user_id = message?.sender_id;

    let prompt = data.toString();

    prompt = getCleanPrompt(prompt, bot_full_name);

    // Checking if the users prompt is one of the consent-change keywords.
    if (await consentChangeCheck(user_id, prompt)) {
        return await returnResponse(`
Your consent has been updated, and will be respected in future messages.\r\n
- You can always remove consent by writing "${commands.remove_consent}" to me.\r\n
- You can see what this bot remembers about you by writing "${commands.show_history}" to me.\r\n
        `);
    }

    // We want to save summaries pr user, pr stream:
    // AKA: If the user says they like hamburgers in #lounge, the bot wont
    // remember it in #random.
    const stream_id = message?.stream_id;
    const summary_id = `${bot_id}-${stream_id}-${user_id}`;

    if (prompt === commands.show_history) {
        const summary = await getChatSummary(summary_id);
        return await returnResponse(summary);
    }

    if (!await basicConsentCheck(user_id)) {
        return consentPrompt(messages);
    }

    const name = message?.sender_full_name;

    const hasFullConsent = await fullConsentCheck(user_id);

    if (hasFullConsent) {
       const summary = await getChatSummary(summary_id);

       if (summary) {
           messages.push({
               "role": "system",
               "content": `Recap of conversation history with this user: ${summary}`
           });
       }
    }

    const user_message = {
        "role": "user",
        "content": `${name}: ${prompt}`
    }

    messages.push(user_message);

    const bot_response = await messageAI(messages);

    if (!bot_response) {
        return returnError('Could not get bot response.');
    }

    if (hasFullConsent) {
        await setChatSummary(summary_id, user_id, bot_id, [user_message], bot_response);
    }

    return returnResponse(bot_response);
}
