import { supabase, commands } from "./shared.ts";

// Checking if the current user has already given a type of consent.
export async function check(
  user_id: number,
  consent_type: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select(consent_type)
    .eq(consent_type, true)
    .eq("id", user_id);

  if (error) {
    console.error(error);
  }

  // If the user has not given consent, we'll return false.
  return !(!data || data?.length === 0);
}

// Has the user given basic consent?
export async function basicCheck(user_id: number): Promise<boolean> {
  return check(user_id, "basic_consent");
}

// Has the user given full consent?
export async function fullCheck(user_id: number): Promise<boolean> {
  return check(user_id, "full_consent");
}

// Update the user's consent status in the Supabase DB.
export async function update(
  user_id: number,
  basic: boolean,
  full: boolean
): Promise<void> {
  const { error } = await supabase.from("users").upsert(
    {
      id: user_id,
      basic_consent: basic,
      full_consent: full,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error(error);
  }
}

// Check if the user has requested a consent change, with a command keyword.
export async function detectAndHandleChange(
  user_id: number,
  prompt: string
): Promise<boolean> {
  let change = false;

  switch (prompt) {
    // The user has agreed to the basic terms, and we will not store chat history.
    case commands.basic_consent:
      await update(user_id, true, false);
      change = true;
      break;

    // The user has agreed to all data terms.
    case commands.full_consent:
      await update(user_id, true, true);
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

// Remove any data about the user, from the Supabase DB.
export async function removeUser(user_id: number): Promise<void> {
  // Supabase is set to cascade mode, so the user will automatically
  // be removed from any other tables, where they are referenced.
  const { error } = await supabase.from("users").delete().eq("id", user_id);

  if (error) {
    console.error(error);
  }
}

// The user has not given GDPR consent.
// We'll need to get them to accept, before we log any data about them,
// or send any information to OpenAI.
export function info(): string {
  return `
  Hej! Før du kan bruge mig, skal du acceptere at jeg sender dit navn, email og besked ud af EU (til Supabase og OpenAI).\r\n
  Du *KAN* vælge at jeg også gemmer en historik over dine beskeder, så jeg kan forbedre min respons i fremtiden.\r\n
  Denne data gemmes i klartekst, og er synlig for min maintainer (Benji).\r\n
Giv venligst samtykke: \r\n
- \`${commands.full_consent}\` for at acceptere \r\n
- \`${commands.basic_consent}\` for at acceptere basal brug UDEN at slå chat-historik til`;
}

// Information to be displayed when the user has changed their consent.
export function updateInfo(): string {
  return `
Din samtykke er blevet opdateret, og vil blive respekteret i fremtidige beskeder.\r\n
Du kan altid fjerne samtykke ved at skrive "${commands.remove_consent}" til mig.\r\n
Du kan se hvad jeg husker om dig ved at skrive "${commands.show_history}" til mig.`;
}
