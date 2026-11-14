import type { Role } from '@prisma/client';
export const permissions: Record<string, Role[]> = {
 students: ['ADMIN'], payments: ['ADMIN','ACCOUNTANT'], attendance: ['ADMIN','FACULTY'], timetables: ['ADMIN'], departments: ['ADMIN'], structures: ['ADMIN','ACCOUNTANT'],
};
export function can(role: Role, action: string) { return permissions[action]?.includes(role) ?? false; }
export function overlaps(a: string, b: string, c: string, d: string) { return a < d && c < b; }
export function attendancePercentage(statuses: string[]) { return statuses.length ? Math.round(statuses.filter(s => s !== 'ABSENT').length / statuses.length * 100) : 0; }

export function resolveAppOrigin(env: Record<string, string | undefined>) {
 const production = env.NODE_ENV === 'production';
 const configured = env.APP_ORIGIN || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : undefined);
 if (production && !configured) throw new Error('Set APP_ORIGIN to the public HTTPS URL (or configure a Railway public domain).');
 const url = new URL(configured || 'http://localhost:5173');
 if (production && url.protocol !== 'https:') throw new Error('APP_ORIGIN must use HTTPS in production.');
 return url.origin;
}
