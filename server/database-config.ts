import { X509Certificate, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Prepare a verified TLS connection for Aiven without storing CA files in Git. */
export function configureDatabase(env: NodeJS.ProcessEnv = process.env, certificateDirectory = path.join(tmpdir(), 'campus-erp-ca')) {
 const raw = env.DATABASE_URL;
 if (!raw) return;
 let url: URL;
 try { url = new URL(raw); } catch { throw new Error('DATABASE_URL is not a valid MySQL connection URL.'); }
 if (url.protocol !== 'mysql:') throw new Error('This application requires a mysql:// DATABASE_URL.');
 const isAiven = url.hostname.endsWith('.aivencloud.com');
 const pem = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
 if (pem) {
  try { new X509Certificate(pem); } catch { throw new Error('DATABASE_CA_CERT must contain the PEM CA certificate downloaded from the database provider.'); }
  const fingerprint = createHash('sha256').update(pem).digest('hex');
  mkdirSync(certificateDirectory, { recursive: true, mode: 0o700 });
  const filename = path.join(certificateDirectory, `${fingerprint}.pem`);
  writeFileSync(filename, pem + '\n', { mode: 0o600 });
  url.searchParams.set('sslcert', filename);
  url.searchParams.set('sslaccept', 'strict');
 } else if (isAiven) {
  const certificate = url.searchParams.get('sslcert');
  if (!certificate) throw new Error('Aiven connections require DATABASE_CA_CERT or a valid sslcert file. Download the project CA from Aiven.');
  try { new X509Certificate(readFileSync(path.resolve('prisma', certificate))); }
  catch { throw new Error('The Aiven CA certificate file cannot be read or is invalid.'); }
  url.searchParams.set('sslaccept', 'strict');
 }
 if (isAiven || pem) {
  // Prisma v6 uses sslcert/sslaccept rather than libmysql's ssl-mode option.
  url.searchParams.delete('ssl-mode');
  url.searchParams.delete('sslmode');
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '3');
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
  env.DATABASE_URL = url.toString();
 }
}
