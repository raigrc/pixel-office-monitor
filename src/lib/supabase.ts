/**
 * Supabase flag helper for Pixel Office Monitor.
 * MVP defaults to in-memory Map; set NEXT_PUBLIC_USE_SUPABASE=1 to delegate to Supabase.
 * Do not require Supabase to run — all helpers are safe when flag is off or env missing.
 */

export function isSupabaseEnabled(): boolean {
  // NEXT_PUBLIC_USE_SUPABASE is the canonical flag per PLAN §5.
  // Accept "1" / "true" (case-insensitive) as enabled.
  const raw =
    process.env.NEXT_PUBLIC_USE_SUPABASE ??
    process.env.USE_SUPABASE ??
    "0";
  return raw === "1" || String(raw).toLowerCase() === "true";
}

export function getSupabaseEnv(): {
  url: string | undefined;
  anonKey: string | undefined;
  serviceRoleKey: string | undefined;
} {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
