import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })
pool.on('error', (error) => {
  console.error('[db] pool error:', error)
})
export const db = drizzle(pool, { schema })
