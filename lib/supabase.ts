import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eiujcxatuvrvkmxeouai.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdWpjeGF0dXZydmtteGVvdWFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTIxNTUsImV4cCI6MjA5NDc2ODE1NX0._OM3Ex7WyeAPLYupbxvM6CfSb4zRnjhPXmoENv1oup0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)