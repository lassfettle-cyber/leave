import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Create a connection pool
export const db = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
})

// Test the connection
db.on('connect', () => {
  console.log('Connected to Neon database')
})

db.on('error', (err) => {
  console.error('Database connection error:', err)
})
