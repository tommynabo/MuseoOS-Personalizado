import { createClient } from '@supabase/supabase-js';

// Access environment variables with import.meta.env (Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bxskvcdebzxzzgbgqlvl.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4c2t2Y2RlYnp4enpnYmdxbHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTU2MTksImV4cCI6MjA5MDYzMTYxOX0.IHMC3rKCvR_WA3X53i3llsH2MYubLjRA5Oep8hykmew';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials using Pablo defaults. Set VITE_SUPABASE_URL for other environments.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
