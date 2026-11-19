/**
 * Dialect helpers.
 *
 * The schema is declared once in a dialect neutral way and rendered to
 * PostgreSQL, MySQL 8 or SQLite DDL.  Keeping the declaration in one place
 * means the supported engines can never drift apart.
 */

const isMySQL = (dialect) => dialect === 'mysql';
const isPostgres = (dialect) => dialect === 'postgres';

const quote = (dialect, ident) => {
  if (isMySQL(dialect)) return `\`${ident}\``;
  // Postgres and SQLite both use double-quoted identifiers.
  return `"${ident}"`;
};

const renderType = (dialect, spec) => {
  switch (spec.type) {
    case 'id':
      if (isMySQL(dialect)) return 'INT';
      if (isPostgres(dialect)) return 'SERIAL';
      return 'INTEGER';
    case 'int':
      if (isMySQL(dialect)) return 'INT';
      if (isPostgres(dialect)) return 'INTEGER';
      return 'INTEGER';
    case 'bigint':
      if (isMySQL(dialect)) return 'BIGINT';
      if (isPostgres(dialect)) return 'BIGINT';
      return 'INTEGER';
    case 'bool':
      // Stored as a small integer everywhere so the existing `= 1` / `= 0`
      // comparisons keep working identically on all three engines.
      if (isMySQL(dialect)) return 'TINYINT(1)';
      if (isPostgres(dialect)) return 'SMALLINT';
      return 'INTEGER';
    case 'real':
      if (isMySQL(dialect)) return 'DOUBLE';
      if (isPostgres(dialect)) return 'DOUBLE PRECISION';
      return 'REAL';
    case 'datetime':
      if (isMySQL(dialect)) return 'DATETIME';
      if (isPostgres(dialect)) return 'TIMESTAMPTZ';
      return 'TEXT';
    case 'json':
      // Kept as text so a plain JSON string can be written without an
      // explicit ::json cast on every INSERT.
      if (isMySQL(dialect)) return 'JSON';
      return 'TEXT';
    case 'text':
    default:
      if (isMySQL(dialect)) {
        return spec.long ? 'TEXT' : 'VARCHAR(191)';
      }
      return 'TEXT';
  }
};

const renderDefault = (dialect, spec) => {
  if (spec.default === undefined) return '';
  if (spec.default === null) return ' DEFAULT NULL';
  if (spec.type === 'bool') {
    return ` DEFAULT ${spec.default ? 1 : 0}`;
  }
  if (spec.type === 'int' || spec.type === 'bigint' || spec.type === 'real') {
    return ` DEFAULT ${spec.default}`;
  }
  if (spec.type === 'datetime') {
    if (isMySQL(dialect)) return ' DEFAULT CURRENT_TIMESTAMP';
    if (isPostgres(dialect)) return ' DEFAULT CURRENT_TIMESTAMP';
    return " DEFAULT '1970-01-01T00:00:00.000Z'";
  }
  return ` DEFAULT '${String(spec.default).replace(/'/g, "''")}'`;
};

/**
 * Render the CREATE TABLE statement for a single table declaration.
 */
const renderTable = (dialect, tableName, table) => {
  const lines = [];

  for (const [columnName, spec] of Object.entries(table.columns)) {
    const parts = [quote(dialect, columnName)];
    parts.push(renderType(dialect, spec));

    if (spec.type === 'id') {
      // MySQL requires AUTO_INCREMENT to be declared before the key.
      if (isMySQL(dialect)) {
        parts.push('NOT NULL AUTO_INCREMENT PRIMARY KEY');
      } else if (isPostgres(dialect)) {
        // SERIAL implies NOT NULL + default, but NOT PRIMARY KEY – add it.
        parts.push('PRIMARY KEY');
      } else {
        parts.push('PRIMARY KEY AUTOINCREMENT');
      }
    } else if (spec.primary) {
      parts.push('PRIMARY KEY');
    }

    if (spec.nullable === false && spec.default === undefined && spec.type !== 'id') {
      parts.push('NOT NULL');
    }

    const defaultClause = renderDefault(dialect, spec);
    if (defaultClause) parts.push(defaultClause.trim());

    if (spec.references) {
      parts.push(
        `REFERENCES ${quote(dialect, spec.references.table)}(${quote(dialect, spec.references.column)}) ON DELETE ${spec.references.onDelete || 'CASCADE'}`
      );
    }

    lines.push(parts.join(' '));
  }

  // Indexes are created separately by `Database.migrate()` because a
  // `CREATE INDEX` statement cannot be part of a `CREATE TABLE` body.
  return `CREATE TABLE IF NOT EXISTS ${quote(dialect, tableName)} (\n  ${lines.join(',\n  ')}\n)${
    isMySQL(dialect) ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : ''
  }`;
};

/**
 * Render a standalone CREATE INDEX statement.
 *
 * PostgreSQL supports `IF NOT EXISTS` which makes the migration fully
 * idempotent; MySQL and SQLite need the "already exists" error to be
 * swallowed by the caller instead.
 */
const renderIndex = (dialect, tableName, index) => {
  const cols = index.columns.map((c) => quote(dialect, c)).join(', ');
  const unique = index.unique ? 'UNIQUE ' : '';
  const indexName = `idx_${tableName}_${index.name}`;
  const ifNotExists = isPostgres(dialect) ? 'IF NOT EXISTS ' : '';
  return `CREATE ${unique}INDEX ${ifNotExists}${quote(dialect, indexName)} ON ${quote(dialect, tableName)} (${cols})`;
};

module.exports = { renderTable, renderIndex, renderType, quote, isMySQL, isPostgres };
