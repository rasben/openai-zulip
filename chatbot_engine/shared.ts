// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Init'ing the supabase CLI.
export const supabase = createClient(
  // @ts-ignore
  Deno.env.get("SUPABASE_URL") ?? "",
  // @ts-ignore
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

// The various consent types, along with their key-phrases.
export const commands = {
  basic_consent: "tjoh",
  full_consent: "ok",
  remove_consent: "delete",
  show_history: "history",
};
