import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log("[SUPABASE] Initializing...");
console.log("[SUPABASE] URL configured:", supabaseUrl ? "Yes" : "No");
console.log("[SUPABASE] Key configured:", supabaseAnonKey ? "Yes" : "No");

if (!supabaseUrl) {
  console.error("[SUPABASE] Missing EXPO_PUBLIC_SUPABASE_URL environment variable");
  console.error("[SUPABASE] Please add EXPO_PUBLIC_SUPABASE_URL in the Rork secrets settings");
}

if (!supabaseAnonKey) {
  console.error("[SUPABASE] Missing EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable");
  console.error("[SUPABASE] Please add EXPO_PUBLIC_SUPABASE_ANON_KEY in the Rork secrets settings");
}

let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  console.log("[SUPABASE] Creating client with URL:", supabaseUrl.substring(0, 30) + "...");
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      fetch: async (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log("[SUPABASE] Fetch error:", errorMessage);
          throw error;
        }
      },
    },
  });
  console.log("[SUPABASE] Client created successfully");
} else {
  console.warn("[SUPABASE] Running with placeholder config - Supabase operations will fail");
  console.warn("[SUPABASE] To fix: Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Rork secrets");
  supabase = createClient("https://placeholder.supabase.co", "placeholder-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export { supabase };

export const isSupabaseConfigured = (): boolean => {
  const configured = Boolean(supabaseUrl && supabaseAnonKey);
  if (!configured) {
    console.log("[SUPABASE] isSupabaseConfigured check: NOT configured");
  }
  return configured;
};

export const checkSupabaseConnection = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.log("[SUPABASE] Connection check: Not configured");
    return false;
  }
  
  try {
    console.log("[SUPABASE] Testing connection...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const { error } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);
    
    clearTimeout(timeoutId);
    
    if (error) {
      console.log("[SUPABASE] Connection check failed:", error.message);
      return false;
    }
    
    console.log("[SUPABASE] Connection check: Success");
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log("[SUPABASE] Connection check error:", errorMessage);
    return false;
  }
};
