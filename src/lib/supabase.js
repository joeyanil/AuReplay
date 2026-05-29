import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wmqsiynsqevfwnuggnsm.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcXNpeW5zcWV2ZndudWdnbnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODEwNzAsImV4cCI6MjA5NTY1NzA3MH0.inpq-2F19cEHBC_utph3Gcaa5VcKdDAaVeYA0Lf4p9w'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Trades ────────────────────────────────────────────────────────────────────

export async function saveTrade(trade) {
  const { data, error } = await supabase
    .from('trades')
    .insert([trade])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function loadTrades() {
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('closed_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function deleteTrade(id) {
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) throw error
}

// ── Stats snapshot ────────────────────────────────────────────────────────────

export async function saveStats(stats) {
  // Upsert a single-row stats record (id = 1 always)
  const { error } = await supabase
    .from('stats')
    .upsert([{ id: 1, ...stats }])
  if (error) throw error
}

export async function loadStats() {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .eq('id', 1)
    .single()
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = row not found
  return data || null
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function saveSession(session) {
  const { error } = await supabase
    .from('sessions')
    .upsert([{ id: 1, ...session }])
  if (error) throw error
}

export async function loadSession() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', 1)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data || null
}
