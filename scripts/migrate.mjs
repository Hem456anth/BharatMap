// Applies SQLite migrations (db/migrations/*.sql) and seeds demo data.
// Production (PostGIS): psql "$DATABASE_URL" -f db/postgis/001_init.sql
import { openDb, seed } from '../server/db.js';
const db = openDb();
console.log(seed(db) ? 'Migrated + seeded demo data.' : 'Migrated (data already present).');
