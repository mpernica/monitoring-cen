import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY — zkontrolujte soubor .env (viz .env.example)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
