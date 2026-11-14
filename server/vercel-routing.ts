export function apiRequestUrl(requestUrl: string, capturedPath?: string | string[]) {
 const url = new URL(requestUrl, 'http://localhost');
 const path = capturedPath ?? url.searchParams.get('__erp_path');
 url.searchParams.delete('__erp_path');
 if (path === undefined || path === null) return url.pathname + url.search;
 const route = Array.isArray(path) ? path.join('/') : path;
 // Encode segments to keep a captured ? or # inside the path, not the query.
 const pathname = '/api/' + route.split('/').map(segment => encodeURIComponent(segment)).join('/');
 return pathname + url.search;
}
