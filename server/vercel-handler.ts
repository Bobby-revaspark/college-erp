import type { IncomingMessage, ServerResponse } from 'node:http';
import app from './app';
import { apiRequestUrl } from './vercel-routing';

// Vercel rewrites retain route captures as query parameters. Restore the Express
// URL explicitly so the same /api routes work in Node and in the function.
export default function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
 req.url = apiRequestUrl(req.url || '/', req.query?.__erp_path);
 app(req, res);
}
