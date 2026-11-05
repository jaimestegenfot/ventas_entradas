// Los nombres de tablas y columnas se mantienen para abrir las bases de datos existentes.
export const esquemaBaseDatos = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL, venue TEXT NOT NULL, city TEXT NOT NULL, starts_at TEXT NOT NULL,
      category TEXT NOT NULL, image TEXT NOT NULL, status TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0,
      queue_slots INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tiers (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), name TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK(price_cents >= 0), capacity INTEGER NOT NULL CHECK(capacity > 0)
    );
    CREATE TABLE IF NOT EXISTS queue (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, event_id TEXT NOT NULL REFERENCES events(id),
      visitor_id TEXT NOT NULL, status TEXT NOT NULL, joined_at TEXT NOT NULL, expires_at TEXT,
      UNIQUE(event_id, visitor_id)
    );
    CREATE INDEX IF NOT EXISTS queue_event ON queue(event_id, status, sequence);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), tier_id TEXT NOT NULL REFERENCES tiers(id),
      queue_id TEXT NOT NULL REFERENCES queue(id), visitor_id TEXT NOT NULL, request_key TEXT NOT NULL UNIQUE,
      quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 6), total_cents INTEGER NOT NULL,
      status TEXT NOT NULL, expires_at TEXT NOT NULL, customer_name TEXT NOT NULL DEFAULT '',
      customer_email TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, confirmed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS order_inventory ON orders(tier_id, status, expires_at);
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), code TEXT NOT NULL UNIQUE, checked_in_at TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
  `;
