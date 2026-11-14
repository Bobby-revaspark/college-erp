import { spawnSync } from 'node:child_process';
// A live build must not inherit the earlier static-demo flag from the dashboard.
process.env.VITE_DEMO_MODE = 'false';
function run(script) {
 const result = spawnSync('npm', ['run', script], { stdio: 'inherit', env: process.env });
 if (result.status !== 0) process.exit(result.status ?? 1);
}
run('db:generate');
// Preview builds must not migrate the production database.
if (process.env.VERCEL_ENV === 'production') run('db:migrate');
run('build');
