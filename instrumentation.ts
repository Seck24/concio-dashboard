export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: pool } = await import('./lib/db')

    // Colonnes supplémentaires sur tenants
    await pool.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS password_hash text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS host_name text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ton_de_voix text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS exemple_messages text;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS carnet_hote text;
    `)

    // Colonnes supplémentaires sur reservations et apartments
    await pool.query(`
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_phone text;
      ALTER TABLE apartments ADD COLUMN IF NOT EXISTS city_info text;
      ALTER TABLE apartments ADD COLUMN IF NOT EXISTS activities_nearby text;
      ALTER TABLE apartments ADD COLUMN IF NOT EXISTS parking_tips text;
      ALTER TABLE apartments ADD COLUMN IF NOT EXISTS carnet_appartement text;
    `)

    // Renommer l'ancienne table messages si elle a l'ancien schéma (reservation_id)
    await pool.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'messages' AND column_name = 'reservation_id'
        ) THEN
          ALTER TABLE messages RENAME TO messages_legacy;
        END IF;
      END $$;
    `)

    // Table conversations
    await pool.query(`
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
    `)

    // Nouvelle table messages avec la colonne status
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role text NOT NULL,
        content text NOT NULL,
        status text NOT NULL DEFAULT 'sent',
        sent_at timestamptz DEFAULT now()
      );
    `)

    // Ajout colonne status si table existait déjà sans elle
    await pool.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';
    `)

    // Index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(guest_phone);
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, sent_at);
    `)

    console.log('[Concio] DB migration OK')
  }
}
