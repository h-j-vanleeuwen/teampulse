import { SB, KEY } from './config.js';

let _client = null;

async function getClient() {
  if (_client) return _client;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  _client = createClient(SB, KEY);
  return _client;
}

// Called once on boot to restore an existing session from localStorage.
export async function initAuth() {
  const sb = await getClient();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export async function getSession() {
  const sb = await getClient();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const sb = await getClient();
  await sb.auth.signOut();
}
