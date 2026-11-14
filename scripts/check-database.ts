import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { configureDatabase } from '../server/database-config';
let db: PrismaClient | undefined;
try {
 configureDatabase();
 db = new PrismaClient();
 await db.$queryRaw`SELECT 1`;
 const tables = await db.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE()`;
 console.log(`Database connection successful. Tables in selected database: ${tables[0].count}.`);
 // Reporting connectivity only: never print the connection URL, password or table data.
} catch (error) {
 const candidate = error as { errorCode?: string; code?: string };
 const rawCode = candidate.errorCode || candidate.code || '';
 const code = /^P\d{4}$/.test(rawCode) ? rawCode : /TLS|certificate/i.test(String((error as Error)?.message || '')) ? 'P1011' : '';
 const explanations: Record<string, string> = {
  P1000: 'Database username or password was rejected.',
  P1001: 'Cannot reach the database hostname/port. Check service status and network access.',
  P1002: 'Database connection timed out.',
  P1003: 'The selected database does not exist.',
  P1010: 'The database user has insufficient access.',
  P1011: 'TLS connection failed. Check the project CA certificate and database hostname.',
  P1013: 'The database connection URL is invalid.',
 };
 console.error('Database connection failed' + (code ? ` (${code})` : '') + '. ' + (explanations[code] || 'Verify DATABASE_URL, CA certificate, service status and network access.') + ' Credentials were not printed.');
 process.exitCode = 1;
} finally {
 await db?.$disconnect();
}
