// src/lib/supabase.ts (Add more debugging)
import { createClient } from '@supabase/supabase-js';

// Debug environment variables
console.log('🔧 Supabase Config Debug:');
console.log('REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL);
console.log('REACT_APP_SUPABASE_ANON_KEY exists:', !!process.env.REACT_APP_SUPABASE_ANON_KEY);
console.log('REACT_APP_SUPABASE_ANON_KEY first 10 chars:', 
  process.env.REACT_APP_SUPABASE_ANON_KEY?.substring(0, 10) + '...');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://kevcsmymkhdyquzzkpdl.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ CRITICAL: Missing Supabase environment variables!');
  console.error('Please check your .env.local file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'x-application-name': 'abuad-face-attendance',
    },
  },
});

// Test the connection immediately
console.log('🧪 Testing Supabase connection...');
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
  } else {
    console.log('✅ Supabase connection successful');
    console.log('Session:', data.session ? 'Active' : 'No session');
  }
});