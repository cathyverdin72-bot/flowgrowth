import { createClient } from "@supabase/supabase-js";
/**
 * GrowthFlow Supabase client.
 *
 * This browser client uses the project's public publishable key.
 * Database permissions must be enforced by Supabase Row Level Security.
 *
 * NEVER place a Supabase service-role or secret key in frontend code.
 */
const supabaseUrl = "https://xsembvcmcodcseqnpyrr.supabase.co";
const supabasePublishableKey =
  "sb_publishable_o-xPKqh8puFT8svdLzIAXA_iJ3En-1E";
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
