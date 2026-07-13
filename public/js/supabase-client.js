import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://bmotbwubruvsrflaufis.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6tJ6DS20TgSxEgWqKKpXJA_G1pkybFs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
