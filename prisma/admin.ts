import { configureDatabase } from '../server/database-config';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
configureDatabase();
const db = new PrismaClient();
async function main() {
 const config = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_NAME: z.string().min(2).max(150),
  ADMIN_PASSWORD: z.string().min(12).max(128),
 }).parse(process.env);
 const email = config.ADMIN_EMAIL.toLowerCase();
 const existing = await db.user.findUnique({ where: { email } });
 if (existing) {
  if (existing.role !== 'ADMIN') throw new Error('This email already belongs to a non-admin user. Choose a new admin email.');
  console.log('Admin already exists; password and permissions preserved.');
  return;
 }
 await db.user.create({ data: { name: config.ADMIN_NAME, email, role: 'ADMIN', passwordHash: await bcrypt.hash(config.ADMIN_PASSWORD, 12) } });
 console.log('Initial admin created successfully.');
}
main().catch(error => {
 console.error(error instanceof z.ZodError ? 'Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD (at least 12 characters).' : error instanceof Error ? error.message : 'Admin setup failed.');
 process.exitCode = 1;
}).finally(() => db.$disconnect());
