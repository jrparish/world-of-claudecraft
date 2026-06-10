import { Pool } from 'pg';
import type { CharacterState } from '../src/sim/sim';
import type { PlayerClass } from '../src/sim/types';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://eastbrook:eastbrook_dev_pw@localhost:5433/eastbrook';

export const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_tokens_account ON auth_tokens(account_id);
CREATE TABLE IF NOT EXISTS characters (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT UNIQUE NOT NULL,
  class TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS characters_account ON characters(account_id);
`;

export async function ensureSchema(): Promise<void> {
  await pool.query(SCHEMA);
}

export interface AccountRow {
  id: number;
  username: string;
  password_hash: string;
}

export async function createAccount(username: string, passwordHash: string): Promise<AccountRow> {
  const res = await pool.query(
    'INSERT INTO accounts (username, password_hash) VALUES ($1, $2) RETURNING id, username, password_hash',
    [username, passwordHash],
  );
  return res.rows[0];
}

export async function findAccount(username: string): Promise<AccountRow | null> {
  const res = await pool.query('SELECT id, username, password_hash FROM accounts WHERE username = $1', [username]);
  return res.rows[0] ?? null;
}

export async function touchLogin(accountId: number): Promise<void> {
  await pool.query('UPDATE accounts SET last_login = now() WHERE id = $1', [accountId]);
}

export async function saveToken(token: string, accountId: number, ttlHours = 24 * 7): Promise<void> {
  await pool.query(
    `INSERT INTO auth_tokens (token, account_id, expires_at) VALUES ($1, $2, now() + ($3 || ' hours')::interval)`,
    [token, accountId, String(ttlHours)],
  );
}

export async function accountForToken(token: string): Promise<number | null> {
  const res = await pool.query(
    'SELECT account_id FROM auth_tokens WHERE token = $1 AND expires_at > now()',
    [token],
  );
  return res.rows[0]?.account_id ?? null;
}

export interface CharacterRow {
  id: number;
  account_id: number;
  name: string;
  class: PlayerClass;
  level: number;
  state: CharacterState | null;
}

export async function listCharacters(accountId: number): Promise<CharacterRow[]> {
  const res = await pool.query(
    'SELECT id, account_id, name, class, level, state FROM characters WHERE account_id = $1 ORDER BY id',
    [accountId],
  );
  return res.rows;
}

export async function getCharacter(accountId: number, characterId: number): Promise<CharacterRow | null> {
  const res = await pool.query(
    'SELECT id, account_id, name, class, level, state FROM characters WHERE id = $1 AND account_id = $2',
    [characterId, accountId],
  );
  return res.rows[0] ?? null;
}

export async function createCharacter(accountId: number, name: string, cls: PlayerClass): Promise<CharacterRow> {
  const res = await pool.query(
    'INSERT INTO characters (account_id, name, class) VALUES ($1, $2, $3) RETURNING id, account_id, name, class, level, state',
    [accountId, name, cls],
  );
  return res.rows[0];
}

export async function deleteCharacter(accountId: number, characterId: number): Promise<boolean> {
  const res = await pool.query('DELETE FROM characters WHERE id = $1 AND account_id = $2', [characterId, accountId]);
  return (res.rowCount ?? 0) > 0;
}

export async function saveCharacterState(characterId: number, level: number, state: CharacterState): Promise<void> {
  await pool.query(
    'UPDATE characters SET level = $2, state = $3, updated_at = now() WHERE id = $1',
    [characterId, level, JSON.stringify(state)],
  );
}
