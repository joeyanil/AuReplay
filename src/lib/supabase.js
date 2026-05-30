import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://wmqsiynsqevfwnuggnsm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtcXNpeW5zcWV2ZndudWdnbnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODEwNzAsImV4cCI6MjA5NTY1NzA3MH0.inpq-2F19cEHBC_utph3Gcaa5VcKdDAaVeYA0Lf4p9w'
)

export async function dbSaveTrade(trade) {
  const { error } = await supabase.from('trades').insert([{
    direction:   trade.direction,
    entry_price: trade.entryPrice,
    exit_price:  trade.exitPrice,
    size:        trade.size,
    pnl:         trade.pnl,
    rr:          trade.rr ?? null,
    opened_at:   trade.openedAt,
    closed_at:   trade.closedAt,
    interval:    trade.interval,
  }])
  if (error) console.warn('Supabase saveTrade:', error.message)
}

export async function dbSaveStats(stats, startingBalance) {
  const { error } = await supabase.from('stats').upsert([{
    id:               1,
    win_rate:         stats.winRate,
    avg_rr:           stats.avgRR,
    biggest_win:      stats.biggestWin,
    biggest_loss:     stats.biggestLoss,
    max_drawdown:     stats.maxDrawdown,
    profit_factor:    stats.profitFactor,
    starting_balance: startingBalance,
    updated_at:       new Date().toISOString(),
  }])
  if (error) console.warn('Supabase saveStats:', error.message)
}
