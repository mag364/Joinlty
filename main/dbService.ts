import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

if (!app.isPackaged) {
  // Keep appData writable and predictable during local development.
  app.setPath('appData', join(process.cwd(), '.appdata'))
}

const MIGRATIONS: Array<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        avatar TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS joints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        owner_type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        starting_balance REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        kind TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        type TEXT NOT NULL,
        category TEXT,
        description TEXT,
        owner_type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        account_id TEXT,
        from_account_id TEXT,
        to_account_id TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recurring_rules (
        id TEXT PRIMARY KEY,
        rule_type TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        category TEXT,
        owner_type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        account_id TEXT,
        schedule TEXT NOT NULL DEFAULT 'monthly',
        day_of_month INTEGER NOT NULL,
        next_run_date TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contribution_settings (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        joint_id TEXT NOT NULL,
        contributes INTEGER NOT NULL,
        method TEXT,
        fixed_amount REAL,
        percent_income REAL,
        split_mode TEXT,
        weight REAL,
        funding_account_id TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(member_id, joint_id)
      );

      CREATE TABLE IF NOT EXISTS generation_log (
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        log_key TEXT NOT NULL UNIQUE,
        transaction_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_generation_log_month ON generation_log(month);
    `,
  },
  {
    version: 2,
    name: 'budget_targets',
    sql: `
      CREATE TABLE IF NOT EXISTS budget_targets (
        id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
        active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        UNIQUE(owner_type, owner_id, category)
      );

      CREATE INDEX IF NOT EXISTS idx_budget_targets_owner ON budget_targets(owner_type, owner_id);
    `,
  },
  {
    version: 3,
    name: 'budget_target_period',
    sql: `
      ALTER TABLE budget_targets ADD COLUMN period TEXT NOT NULL DEFAULT 'monthly';
    `,
  },
  {
    version: 4,
    name: 'member_type',
    sql: `
      ALTER TABLE members ADD COLUMN member_type TEXT NOT NULL DEFAULT 'person';
    `,
  },
  {
    version: 5,
    name: 'member_sort_order',
    sql: `
      ALTER TABLE members ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS seq
        FROM members
      )
      UPDATE members
      SET sort_order = (
        SELECT seq FROM ordered WHERE ordered.id = members.id
      );
    `,
  },
  {
    version: 6,
    name: 'account_sort_order',
    sql: `
      ALTER TABLE accounts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS seq
        FROM accounts
      )
      UPDATE accounts
      SET sort_order = (
        SELECT seq FROM ordered WHERE ordered.id = accounts.id
      );
    `,
  },
]

const DEFAULT_CATEGORIES = [
  { name: 'Housing', kind: 'expense' },
  { name: 'Groceries', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Transport', kind: 'expense' },
  { name: 'Dining', kind: 'expense' },
  { name: 'Healthcare', kind: 'expense' },
  { name: 'Entertainment', kind: 'expense' },
  { name: 'Salary', kind: 'income' },
  { name: 'Rental', kind: 'income' },
  { name: 'Interest', kind: 'income' },
]

let db: Database.Database | null = null

export const getAppDataPaths = () => {
  const baseDir = join(app.getPath('appData'), 'CoupleBudget')
  const storageDir = join(baseDir, 'storage')
  mkdirSync(baseDir, { recursive: true })
  mkdirSync(storageDir, { recursive: true })
  return {
    baseDir,
    storageDir,
    dbPath: join(baseDir, 'couplebudget.sqlite'),
  }
}

export const getDb = () => {
  if (db) return db

  const { dbPath } = getAppDataPaths()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  runMigrations(db)
  seedDefaults(db)
  return db
}

export const clearAllData = (options?: { seedDefaults?: boolean }) => {
  const database = getDb()
  const shouldSeedDefaults = options?.seedDefaults ?? true
  const clearTables = database.transaction(() => {
    const tables = [
      'attachments',
      'generation_log',
      'transactions',
      'recurring_rules',
      'contribution_settings',
      'budget_targets',
      'accounts',
      'members',
      'joints',
      'categories',
      'settings',
    ] as const

    for (const table of tables) {
      database.prepare(`DELETE FROM ${table}`).run()
    }
  })

  clearTables()
  if (shouldSeedDefaults) {
    seedDefaults(database)
  }
}

const runMigrations = (database: Database.Database) => {
  const hasMigrations = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get()

  if (!hasMigrations) {
    database.exec(MIGRATIONS[0].sql)
    database
      .prepare('INSERT OR IGNORE INTO schema_migrations(version, name) VALUES (?, ?)')
      .run(MIGRATIONS[0].version, MIGRATIONS[0].name)
  }

  const applied = new Set<number>(
    database.prepare('SELECT version FROM schema_migrations').all().map((row) => (row as { version: number }).version),
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue
    database.exec(migration.sql)
    database
      .prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)')
      .run(migration.version, migration.name)
  }
}

const seedDefaults = (database: Database.Database) => {
  const now = new Date().toISOString()
  const insertCategory = database.prepare(
    'INSERT OR IGNORE INTO categories(id, name, kind, active, created_at) VALUES (?, ?, ?, 1, ?)',
  )

  for (const category of DEFAULT_CATEGORIES) {
    insertCategory.run(`cat-${category.name.toLowerCase()}`, category.name, category.kind, now)
  }

  const hasJoint = database.prepare('SELECT id FROM joints LIMIT 1').get() as { id: string } | undefined
  if (!hasJoint) {
    database
      .prepare('INSERT INTO joints(id, name, active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)')
      .run('joint-household', 'Household Joint', now, now)
  }
}
