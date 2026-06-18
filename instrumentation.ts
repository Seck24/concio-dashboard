export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: pool } = await import('./lib/db')
    await pool.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS password_hash text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS host_name text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ton_de_voix text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS exemple_messages text;

      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_phone text;

      ALTER TABLE apartments ADD COLUMN IF NOT EXISTS city_info text;
      ALTER TABLE apartments ADD COLUMN IF NOT EXISTS activities_nearby text;
      ALTER TABLE apartments ADD COLUMN IF NOT EXISTS parking_tips text;

      CREATE TABLE IF NOT EXISTS conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
        apartment_id uuid REFERENCES apartments(id) ON DELETE SET NULL,
        guest_name text,
        guest_phone text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role text NOT NULL,
        content text NOT NULL,
        sent_at timestamptz DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(guest_phone);
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, sent_at);
    `)
    console.log('[Concio] DB migration OK')
  }
}
