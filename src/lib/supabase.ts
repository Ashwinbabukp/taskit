import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ajedryvvaeeskkiryrzl.supabase.co";

// Default public anon key ensures Vercel production builds always compile cleanly
// even if environment variables are not yet configured in the dashboard.
const defaultAnonKey = "sb_publishable_7p90IbJU10UiaarNNgnUig_RXOaj9IR";

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  defaultAnonKey;

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});
