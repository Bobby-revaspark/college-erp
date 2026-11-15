import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';

// Aiven uses the verified Linux TLS stack; secrets stay in the API container.
const live = existsSync('.env.aiven');
if (live) {
  console.log('Live Aiven mode: student records will be saved to the database. Docker must be running.');
  const setup = spawn('docker', ['compose','-f','deployment/dev-aiven.compose.yml','up','--build','-d','--wait'], {stdio:'inherit'});
  const status = await new Promise(resolve => {setup.on('error',()=>resolve(1));setup.on('exit',resolve);});
  if (status !== 0) process.exit(1);
}
const command = live
  ? ['vite','--host','0.0.0.0','--port','5173','--strictPort']
  : ['concurrently','-k','vite --host 0.0.0.0','tsx watch server/index.ts'];
const child = spawn('npx', ['--no-install',...command], {stdio:'inherit',env:{...process.env,...(live?{VITE_DEMO_MODE:'false',API_PROXY_TARGET:'http://127.0.0.1:3301'}:{})}});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('error',()=>process.exit(1));
child.on('exit',code=>process.exit(code??0));
