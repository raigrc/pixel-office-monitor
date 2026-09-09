import { createClient } from "@supabase/supabase-js";

/**
 * Service-role admin client — mirrors option-one-solar-dashboard/src/lib/supabase/admin.ts
 * Only call when isSupabaseEnabled() === true. Throws with clear message if env missing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      `Missing Supabase admin env vars: URL=${url ? "set" : "MISSING"}, KEY=${serviceKey ? "set" : "MISSING"}`
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
