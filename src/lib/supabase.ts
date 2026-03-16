import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Fallback so the app doesn't hard-crash if env vars are missing at build time.
// In production (Vercel) make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// in the Vercel dashboard → Project → Settings → Environment Variables.
const url = supabaseUrl || 'https://placeholder.supabase.co'
const key = supabaseAnonKey || 'placeholder-key'

export const supabase = createClient<Database>(url, key)

export type { Database }
