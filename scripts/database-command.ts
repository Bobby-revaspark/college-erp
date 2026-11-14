import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { configureDatabase } from '../server/database-config';
try {
 configureDatabase();
 const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
 process.exitCode = result.status ?? 1;
} catch (error) {
 console.error(error instanceof Error ? error.message : 'Database connection configuration failed.');
 process.exitCode = 1;
}
