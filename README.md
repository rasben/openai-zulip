# Zulip/OpenAI chatbots, powered by Supabase.

A series of chatbots, that takes a prompt from the user, serves it to the OpenAI API and returns the response (chat completion) to the user.

Built to be used with [Zulip's Outgoing Webhook endpoint API](https://zulip.com/api/outgoing-webhooks).

The bot endpoints are served using [Supabase edge-functions](https://supabase.com/docs/guides/functions).

An edge-fuction is just a server-side typescript application. Each chatbot is a seperate edgefunction, and can be found in seperate folders in [supabase/functions/](supabase/functions/)

The chatbot typescript logic is stored in [chatbot_engine/](chatbot_engine/)

The chatbots automatically prompts the user for data-consent the first time they are called, to make sure the user is OK with their data being shared with Supabase and OpenAI.

If the user has given full consent, we also generate and store chat summaries in a [Supabase database, connected to the project](https://supabase.com/docs/guides/database).
These summaries are generated by OpenAI, and passed along to future bot prompts.

## to-do

- Double-proof that no user data has been shared with Supabase before consent has been given
  - (At the moment, temporary data may be stored)

- Add more documentation for others to fork this repo and set up their own chatbot.

- Enable typescript-eslint/no-explicit-any and fix my embarrasing `any`'s.
