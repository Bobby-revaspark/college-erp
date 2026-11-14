import { spawnSync } from 'node:child_process';
// Force bundled demo data even if an old Vercel VITE_DEMO_MODE=false is present.
const env = { ...process.env, VITE_DEMO_MODE: 'true' };
for (const args of [
 ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.frontend.json'],
 ['node_modules/vite/bin/vite.js', 'build'],
]) {
 const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
 if (result.status !== 0) process.exit(result.status ?? 1);
}
