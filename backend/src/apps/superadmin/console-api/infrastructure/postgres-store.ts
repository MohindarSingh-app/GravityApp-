import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';
import type { PersistentState } from '../domain/models.js';
import { isPersistentState, JsonStore } from './json-store.js';

const require = createRequire(import.meta.url);
const { pool } = require('../../../../config/energy_service/db.js') as { pool: Pool };

type StateRow = { state: PersistentState };
type Queryable = Pick<Pool, 'query' | 'connect'>;

export class PostgresStore extends JsonStore {
  constructor(filePath: string, private readonly database: Queryable = pool) {
    super(filePath);
  }

  override async initialize(bootstrap: {
    email: string;
    name: string;
    passwordSalt: string;
    passwordHash: string;
  }): Promise<void> {
    await this.database.query('CREATE SCHEMA IF NOT EXISTS superadmin');
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS superadmin.console_state (
        singleton SMALLINT PRIMARY KEY DEFAULT 1 CHECK (singleton = 1),
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.importLegacyStateIfNeeded();
    await super.initialize(bootstrap);
  }

  protected override async readState(): Promise<PersistentState> {
    const result = await this.database.query<StateRow>(
      'SELECT state FROM superadmin.console_state WHERE singleton = 1',
    );
    if (!result.rows[0]) {
      const error = new Error('Superadmin database state is not initialized.') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    if (!isPersistentState(result.rows[0].state)) {
      throw new Error('The Superadmin database state has an unsupported or invalid structure.');
    }
    return result.rows[0].state;
  }

  protected override async writeState(state: PersistentState): Promise<void> {
    await this.database.query(
      `INSERT INTO superadmin.console_state (singleton, state)
       VALUES (1, $1::jsonb)
       ON CONFLICT (singleton) DO UPDATE
       SET state = EXCLUDED.state, updated_at = NOW()`,
      [JSON.stringify(state)],
    );
  }

  protected override async mutate<T>(change: (state: PersistentState) => T): Promise<T> {
    const operation = this.writeQueue.then(async () => {
      const client: PoolClient = await this.database.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query<StateRow>(
          'SELECT state FROM superadmin.console_state WHERE singleton = 1 FOR UPDATE',
        );
        if (!result.rows[0] || !isPersistentState(result.rows[0].state)) {
          throw new Error('The Superadmin database state is unavailable or invalid.');
        }
        const state = result.rows[0].state;
        const value = change(state);
        await client.query(
          `UPDATE superadmin.console_state
           SET state = $1::jsonb, updated_at = NOW()
           WHERE singleton = 1`,
          [JSON.stringify(state)],
        );
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async importLegacyStateIfNeeded(): Promise<void> {
    const existing = await this.database.query(
      'SELECT 1 FROM superadmin.console_state WHERE singleton = 1',
    );
    if (existing.rowCount) return;

    let contents: string;
    try {
      contents = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
      throw error;
    }

    let state: unknown;
    try {
      state = JSON.parse(contents);
    } catch (error) {
      throw new Error(`The legacy Superadmin state file contains invalid JSON: ${String(error)}`);
    }
    if (!isPersistentState(state)) {
      throw new Error('The legacy Superadmin state file has an unsupported or invalid structure.');
    }
    await this.database.query(
      `INSERT INTO superadmin.console_state (singleton, state)
       VALUES (1, $1::jsonb)
       ON CONFLICT (singleton) DO NOTHING`,
      [JSON.stringify(state)],
    );
  }
}
