import 'dotenv/config'

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const CSV_PATH = 'docs/ins_31lWXXgV4ypNnDoMOERKgfk9tHB (1).csv'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function readCsvUserIds() {
  const lines = fs.readFileSync(CSV_PATH, 'utf8').trim().split(/\r?\n/)
  return new Set(lines.slice(1).map((line) => line.split(',')[0]).filter(Boolean))
}

async function getExistingUserCreditIds() {
  const { data, error } = await supabase
    .from('user_credits')
    .select('user_id')
    .order('user_id')

  if (error) {
    throw new Error(`Failed to load existing user_credits: ${error.message}`)
  }

  return new Set((data ?? []).map((row) => row.user_id))
}

async function countTable(table: 'user_credits' | 'credit_transactions') {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`)
  }

  return count ?? 0
}

async function main() {
  const csvIds = readCsvUserIds()
  const existingIds = await getExistingUserCreditIds()
  const missingIds = [...csvIds].filter((userId) => !existingIds.has(userId)).sort()

  const beforeUserCredits = await countTable('user_credits')
  const beforeTransactions = await countTable('credit_transactions')

  console.log(`CSV users: ${csvIds.size}`)
  console.log(`Existing user_credits: ${existingIds.size}`)
  console.log(`Missing users to backfill: ${missingIds.length}`)

  if (missingIds.length === 0) {
    console.log(JSON.stringify({
      beforeUserCredits,
      beforeTransactions,
      afterUserCredits: beforeUserCredits,
      afterTransactions: beforeTransactions,
      insertedUsers: 0,
    }, null, 2))
    return
  }

  // Schema verified via Supabase MCP (2026-06-01):
  // user_credits columns used: user_id, credits_remaining.
  const { error: creditsError } = await supabase
    .from('user_credits')
    .insert(
      missingIds.map((userId) => ({
        user_id: userId,
        credits_remaining: 0,
      }))
    )

  if (creditsError) {
    throw new Error(`Failed to insert user_credits rows: ${creditsError.message}`)
  }

  const afterUserCredits = await countTable('user_credits')
  const afterTransactions = await countTable('credit_transactions')

  console.log(JSON.stringify({
    beforeUserCredits,
    afterUserCredits,
    beforeTransactions,
    afterTransactions,
    insertedUsers: missingIds.length,
    insertedUserIds: missingIds,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
