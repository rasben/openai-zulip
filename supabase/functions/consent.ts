import {
    supabase,
    commands
} from './shared.ts'

import {
    callAPI as openAICallAPI,
} from './openai.ts'

// Checking if the current user has already given a type of consent.
export async function check(
    user_id: number,
    consent_type: string
) {
    const { data, error } = await supabase
        .from('users')
        .select(consent_type)
        .eq(consent_type, true)
        .eq('id', user_id)

    if (error) {
        console.error(error)
    }

    // If the user has not given consent, we'll return false.
    return (data && data?.length !== 0)
}

// Has the user given basic consent?
export async function basicCheck(user_id: number) {
    return check(user_id, 'basic_consent')
}

// Has the user given full consent?
export async function fullCheck(user_id: number) {
    return check(user_id, 'full_consent')
}

// Update the user's consent status in the Supabase DB.
export async function update(
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
        }, { onConflict: 'id' })

    if (error) {
        console.error(error)
    }
}

// Check if the user has requested a consent change, with a command keyword.
export async function detectAndHandleChange(user_id: number, prompt: string) {
    let change = false

    switch (prompt) {
        // The user has agreed to the basic terms, and we will not store chat history.
        case commands.basic_consent:
            await update(user_id, true, false)
            change = true
            break

        // The user has agreed to all data terms.
        case commands.full_consent:
            await update(user_id, true, true)
            change = true
            break

        // The user wants to have data deleted, and consent revoked.
        case commands.remove_consent:
            await removeUser(user_id)
            change = true
            break
    }

    return change
}

// Remove any data about the user, from the Supabase DB.
export async function removeUser(user_id: number) {
    // Supabase is set to cascade mode, so the user will automatically
    // be removed from any other tables, where they are referenced.
    const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', user_id)

    if (error) {
        console.error(error)
    }
}

// The user has not given GDPR consent.
// We'll need to get them to accept, before we log any data about them,
// or send any information to OpenAI.
// Let's just use ChatGPT to create a friendly message, in the style of the
// bot - as long as we dont tell the bot anything about the user,
// or their message it's all good.
export async function info(messages: any) {
    messages.push({
        "role": "system",
        "content": `
Inform the user in clear terms that: 
1) If they want to use this bot, they need to accept that their username, email and message 
will be sent outside EU (Supabase & OpenAI) 
2) They can choose that the bot also stories a summary of their messages, to better respond in the future. 
This data is stored in plaintext, visible for the bot-maintainer (Benji) 
3) None of their data nor message has been logged yet`
    })

    let reply = await openAICallAPI(messages)

    reply = `${reply}\r\n\r\n
Giv venligst samtykke: \r\n
- \`${commands.full_consent}\` for at acceptere \r\n
- \`${commands.basic_consent}\` for at acceptere basalt brug UDEN at slå chat-historik til`

    return reply
}

// Information to be displayed when the user has changed their consent.
export async function updateInfo() {
    return `
Your consent has been updated, and will be respected in future messages.\r\n
- You can always remove consent by writing "${commands.remove_consent}" to me.\r\n
- You can see what this bot remembers about you by writing "${commands.show_history}" to me.\r\n
    `
}
