export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: pool } = await import('./lib/db')
    await pool.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS password_hash text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS host_name text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ton_de_voix text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS exemple_messages text;
    `)
    console.log('[Concio] DB migration OK')
  }
}
