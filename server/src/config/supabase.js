import { createClient } from '@supabase/supabase-js';
import config from './index.js';
import logger from '../utils/logger.js';

if (!config.supabase.url || !config.supabase.serviceKey) {
  logger.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY');
}

// Service role client for server-side operations (bypasses RLS)
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Anon client for client-facing operations (respects RLS)
export const supabaseAnon = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

export default supabase;
