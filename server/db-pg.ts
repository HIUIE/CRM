import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'smarttrade_crm',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function initPgDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        display_id TEXT UNIQUE,
        name TEXT,
        country TEXT,
        contact TEXT,
        logistics_preference TEXT,
        payment_terms TEXT,
        source_channel TEXT,
        intent_products TEXT,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        partner_type TEXT NOT NULL,
        country TEXT,
        contact TEXT,
        payment_terms TEXT,
        remark TEXT,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        display_id TEXT UNIQUE,
        customer_id INTEGER REFERENCES customers(id),
        status TEXT,
        details TEXT,
        total_amount REAL,
        product_summary TEXT,
        delivery_date TEXT,
        key_milestone TEXT,
        freight_amount REAL DEFAULT 0,
        misc_amount REAL DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        specification TEXT,
        quantity REAL NOT NULL,
        unit TEXT,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS finance_records (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        partner_id INTEGER REFERENCES partners(id),
        type TEXT,
        amount REAL,
        target TEXT,
        status TEXT,
        remark TEXT,
        currency TEXT,
        payment_category TEXT,
        record_category TEXT,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS logistics_records (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        tracking_no TEXT,
        carrier TEXT,
        packing_details TEXT,
        status TEXT,
        shipping_date TEXT,
        segment_type TEXT,
        package_count REAL,
        volume_cbm REAL,
        gross_weight_kg REAL,
        incoterm TEXT,
        transport_mode TEXT,
        vessel_voyage TEXT,
        bill_no TEXT,
        etd TEXT,
        eta TEXT,
        remark TEXT,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customs_records (
        id SERIAL PRIMARY KEY,
        order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        status TEXT,
        broker_name TEXT,
        declaration_no TEXT,
        declaration_date TEXT,
        release_date TEXT,
        remark TEXT,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS production_plans (
        id SERIAL PRIMARY KEY,
        order_id INTEGER UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        partner_id INTEGER REFERENCES partners(id),
        order_date TEXT,
        estimated_delivery_date TEXT,
        production_status TEXT,
        inspection_status TEXT,
        remark TEXT,
        created_by INTEGER REFERENCES users(id),
        updated_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS production_logs (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS packing_records (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        package_count REAL,
        package_size TEXT,
        gross_weight REAL,
        net_weight REAL,
        attachment_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id SERIAL PRIMARY KEY,
        entity_type TEXT,
        entity_id INTEGER,
        file_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        file_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        remark TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_name TEXT,
        action_type TEXT,
        entity_type TEXT,
        entity_id TEXT,
        old_value TEXT,
        new_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customer_contacts (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        title TEXT,
        email TEXT,
        contact TEXT,
        is_primary INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS customer_followups (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        channel TEXT DEFAULT 'other',
        created_by INTEGER REFERENCES users(id),
        created_by_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        assignee_id INTEGER NOT NULL REFERENCES users(id),
        due_date TEXT NOT NULL,
        priority TEXT DEFAULT 'P2',
        status TEXT DEFAULT 'todo',
        entity_type TEXT,
        entity_id TEXT,
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_follow_ups (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_attachments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        attachment_id INTEGER NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        comment_id INTEGER
      );

      INSERT INTO settings (key, value) VALUES ('site_name', 'SmartTrade AI CRM') ON CONFLICT (key) DO NOTHING;
    `);

    // Seed root user if not exists
    const existing = await client.query('SELECT id FROM users WHERE username = $1', ['root']);
    if (!existing.rows.length) {
      const bcrypt = await import('bcryptjs');
      const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'root';
      const hash = await bcrypt.hash(initialPassword, 10);
      await client.query(
        'INSERT INTO users (username, password, role, name, active) VALUES ($1, $2, $3, $4, 1)',
        ['root', hash, 'admin', 'Super Admin'],
      );
    } else {
      await client.query("UPDATE users SET active = 1 WHERE username = 'root'");
    }
  } finally {
    client.release();
  }
}

export async function initPgTables() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
  await initPgDb();
}

export const pgDb = {
  async query<T>(text: string, params?: unknown[]): Promise<T> {
    const result = await pool.query(text, params);
    return result.rows as T;
  },
  async end() {
    await pool.end();
  },
};

export default pool;
