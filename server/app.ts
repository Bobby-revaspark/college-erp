import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { PrismaClient, Prisma, type User } from '@prisma/client';
import { z } from 'zod';
import { can, overlaps, resolveAppOrigin, isPastOrTodayDate } from './security';
import { configureDatabase } from './database-config';
import { defaultInstitution, paymentReceiptBalances } from './institution';
import { registerStudentPayments, paymentRequestSelect } from './student-payments';
configureDatabase();
const db = new PrismaClient();
const app = express();
const production = process.env.NODE_ENV === 'production';
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace-with-')) throw new Error('JWT_SECRET must contain at least 32 characters. Configure .env before starting.');
const origin = resolveAppOrigin(process.env);
// Hosting platforms terminate HTTPS at their reverse proxy. Limit forwarded-header trust to the last hop.
if (production) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy: production ? undefined : false}));
app.use(express.json({limit:'3mb'}));
app.use(cookieParser());
app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.use('/api',rateLimit({windowMs:60_000,limit:240}));
app.use('/api',(req,res,next)=>{
 if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin !== origin) { res.status(403).json({error:'Invalid request origin'}); return; } next();
});
type AuthRequest = Request & { user?: User; sessionId?: string };
const safeUser = (u:User)=>({id:u.id,name:u.name,email:u.email,role:u.role});
const cookies = {httpOnly:true,secure:production,sameSite:'lax' as const,path:'/'};
app.get('/api/institution',async(_req,res)=>{const settings=await db.institution.findUnique({where:{id:'college'}})||defaultInstitution();const {paymentUpiId,paymentBankDetails,paymentInstructions,paymentQrUrl,...branding}=settings;res.json(branding);});
app.get('/api/health',async (_req,res)=>{await db.$queryRaw`SELECT 1`;res.json({status:'ok'});});
app.post('/api/auth/login',rateLimit({windowMs:900_000,limit:15}),async(req,res)=>{
 const input=z.object({email:z.email(),password:z.string().min(1).max(128)}).parse(req.body);
 const user=await db.user.findUnique({where:{email:input.email.toLowerCase()}});
 if(!user || !user.active || !await bcrypt.compare(input.password,user.passwordHash)){res.status(401).json({error:'Invalid email or password'});return;}
 await db.session.deleteMany({where:{expiresAt:{lt:new Date()}}});
 const id=randomUUID(); const expiresAt=new Date(Date.now()+8*3600_000);
 await db.session.create({data:{id,userId:user.id,expiresAt}});
 res.cookie('session',jwt.sign({sid:id},secret,{expiresIn:'8h',algorithm:'HS256'}),{...cookies,maxAge:8*3600_000}).json({user:safeUser(user)});
});
app.use('/api',async(req:AuthRequest,res,next)=>{
 try {const token=jwt.verify(req.cookies.session || '',secret,{algorithms:['HS256']}) as {sid:string};
 const session=await db.session.findUnique({where:{id:token.sid},include:{user:true}});
 if(!session || session.expiresAt<new Date() || !session.user.active) throw new Error();
 req.user=session.user;req.sessionId=session.id;next();
 }catch(error){if(error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientKnownRequestError){next(error);return;}res.status(401).json({error:'Please sign in to continue'});}
});
app.get('/api/auth/me',(req:AuthRequest,res)=>res.json({user:safeUser(req.user!)}));
app.post('/api/auth/logout',async(req:AuthRequest,res)=>{await db.session.deleteMany({where:{id:req.sessionId}});res.clearCookie('session',cookies).json({ok:true});});
const permit=(action:string)=>(req:AuthRequest,res:Response,next:NextFunction)=>{if(!can(req.user!.role,action)){res.status(403).json({error:'You do not have permission for this action'});return;}next();};
registerStudentPayments(app,db);
app.get('/api/bootstrap',async(req:AuthRequest,res)=>{
 const u=req.user!;
 const lectures=await db.timetable.findMany({where:u.role==='FACULTY'?{facultyId:u.id}:undefined});
 let studentWhere:Prisma.StudentWhereInput={};
 if(u.role==='STUDENT') studentWhere={userId:u.id};
 if(u.role==='FACULTY') studentWhere={OR:lectures.map(t=>({courseId:t.courseId,semester:t.semester}))};
 const students=await db.student.findMany({where:studentWhere,include:{department:true,course:true,transactions:{select:{amount:true}}},orderBy:{enrollment:'asc'}});
 const ids=students.map(s=>s.id);
 const own=students[0];
 const [departments,courses,feeStructures,transactions,attendance,timetables,subjects,faculty]=await Promise.all([
 db.department.findMany(),db.course.findMany(),u.role==='FACULTY'?[]:db.feeStructure.findMany(),
 u.role==='FACULTY'?[]:db.feeTransaction.findMany({where:{studentId:{in:ids}},include:{student:{select:{name:true,enrollment:true}}},orderBy:{date:'desc'}}),
 db.attendance.findMany({where:{studentId:{in:ids}}}),
 u.role==='FACULTY'?lectures:db.timetable.findMany({where:u.role==='STUDENT'?{courseId:own?.courseId ?? '__none',semester:own?.semester}:undefined}),
 db.subject.findMany(),db.user.findMany({where:{role:'FACULTY',active:true},select:{id:true,name:true}})
 ]);
 const paymentRequests=u.role==='FACULTY'?[]:await db.studentPaymentRequest.findMany({where:u.role==='STUDENT'?{student:{userId:u.id}}:undefined,select:paymentRequestSelect,orderBy:{createdAt:'desc'},take:200});
 const institution=await db.institution.findUnique({where:{id:'college'}})||defaultInstitution();
 const receiptBalances=paymentReceiptBalances(transactions,new Map(students.map(s=>[s.id,Number(s.totalFee)])));
 const users=u.role==='ADMIN'?await db.user.findMany({where:{role:{not:'STUDENT'}},select:{id:true,name:true,email:true,role:true}}):[];
 res.json({institution,paymentRequests:paymentRequests.map(r=>({...r,amount:Number(r.amount)})),users,students:students.map(({transactions,...s})=>({...s,totalFee:u.role==='FACULTY'?0:Number(s.totalFee),paid:u.role==='FACULTY'?0:transactions.reduce((v,t)=>v+Number(t.amount),0)})),departments,courses,feeStructures,transactions:transactions.map(t=>({...t,amount:Number(t.amount),balanceAfter:receiptBalances.get(t.id)})),attendance,timetables,subjects,faculty});
});
const id=z.string().min(1).max(100);const semester=z.coerce.number().int().min(1).max(12);const money=z.coerce.number().min(0).max(10_000_000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001,'Use at most two decimal places');
const date=z.coerce.date().refine(d=>isPastOrTodayDate(d),'Date cannot be in the future');
app.post('/api/students',permit('students'),async(req,res)=>{
 const s=z.object({name:z.string().min(2).max(150),email:z.email(),phone:z.string().min(7).max(20),dob:date,gender:z.string().min(1).max(30),photo:z.string().max(2_800_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional(),address:z.string().min(3).max(2000),guardianName:z.string().min(2),guardianPhone:z.string().min(7),departmentId:id,courseId:id,semester,batch:z.string().min(4).max(30),admissionDate:date,password:z.string().min(12).max(128)}).parse(req.body);
 const course=await db.course.findUnique({where:{id:s.courseId}});if(course?.departmentId!==s.departmentId){res.status(400).json({error:'Course does not belong to department'});return;}
 const fees=await db.feeStructure.findUnique({where:{courseId_semester:{courseId:s.courseId,semester:s.semester}}});if(!fees){res.status(400).json({error:'Set up a fee structure for this course and semester first'});return;}
 const {password,courseId,departmentId,...data}=s;const passwordHash=await bcrypt.hash(password,12);
 const student=await db.student.create({data:{...data,email:s.email.toLowerCase(),enrollment:`ERP-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`,totalFee:Number(fees.tuition)+Number(fees.exam)+Number(fees.library)+Number(fees.lab),course:{connect:{id:courseId}},department:{connect:{id:departmentId}},user:{create:{name:s.name,email:s.email.toLowerCase(),passwordHash,role:'STUDENT' as const}}}});
 res.status(201).json(student);
});
app.post('/api/payments',permit('payments'),async(req:AuthRequest,res)=>{
 const p=z.object({requestId:z.uuid().optional(),studentId:id,amount:money.refine(v=>v>0),mode:z.enum(['CASH','UPI','BANK_TRANSFER','CARD']),transactionId:z.string().max(120).optional(),date}).parse(req.body);
 if(p.mode!=='CASH'&&!p.transactionId?.trim()){res.status(400).json({error:'Transaction reference is required'});return;}
 const result=await db.$transaction(async tx=>{
 // Lock student row so simultaneous collections cannot exceed the outstanding balance.
 await tx.$queryRaw`SELECT id FROM Student WHERE id = ${p.studentId} FOR UPDATE`;
 if(p.requestId){
  const existing=await tx.feeTransaction.findUnique({where:{requestId:p.requestId}});
  if(existing){
   if(existing.studentId!==p.studentId || Number(existing.amount)!==p.amount || existing.mode!==p.mode || (existing.transactionId||'')!==(p.transactionId?.trim()||'') || existing.date.getTime()!==p.date.getTime())throw Object.assign(new Error('Payment reference was already used for different details'),{status:409});
   return existing;
  }
 }
 const student=await tx.student.findUniqueOrThrow({where:{id:p.studentId}});
 const paid=await tx.feeTransaction.aggregate({where:{studentId:p.studentId},_sum:{amount:true}});
 if(new Prisma.Decimal(p.amount).greaterThan(student.totalFee.minus(paid._sum.amount??0))) throw Object.assign(new Error('Payment exceeds remaining balance'),{status:400});
 return tx.feeTransaction.create({data:{...p,balanceAfter:student.totalFee.minus(paid._sum.amount??0).minus(p.amount),transactionId:p.transactionId?.trim()||null,recordedById:req.user!.id,receiptNumber:`RCP-${Date.now()}-${randomUUID().slice(0,6).toUpperCase()}`}});
 });res.status(201).json({...result,amount:Number(result.amount),balanceAfter:result.balanceAfter==null?null:Number(result.balanceAfter)});
});
app.post('/api/attendance',permit('attendance'),async(req:AuthRequest,res)=>{
 const input=z.object({date,subjectId:id,records:z.array(z.object({studentId:id,status:z.enum(['PRESENT','ABSENT','LATE'])})).min(1).max(500)}).parse(req.body);
 const subject=await db.subject.findUniqueOrThrow({where:{id:input.subjectId}});
 if(req.user!.role==='FACULTY'&&!await db.timetable.findFirst({where:{facultyId:req.user!.id,subjectId:subject.id}})){res.status(403).json({error:'Subject is not assigned to you'});return;}
 const ids=input.records.map(r=>r.studentId);
 if(new Set(ids).size!==ids.length || await db.student.count({where:{id:{in:ids},courseId:subject.courseId,semester:subject.semester}})!==ids.length){res.status(400).json({error:'Roster does not match subject'});return;}
 const day=new Date(input.date.toISOString().slice(0,10)+'T00:00:00Z');
 await db.$transaction(input.records.map(r=>db.attendance.upsert({where:{studentId_subjectId_date:{studentId:r.studentId,subjectId:subject.id,date:day}},create:{...r,subjectId:subject.id,date:day},update:{status:r.status}})));
 res.json({ok:true});
});
app.post('/api/timetables',permit('timetables'),async(req,res)=>{
 const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
 const t=z.object({courseId:id,semester,subjectId:id,facultyId:id,day:z.coerce.number().int().min(1).max(6),startTime:time,endTime:time,room:z.string().min(1).max(60)}).parse(req.body);
 if(t.startTime>=t.endTime) throw Object.assign(new Error('End time must follow start time'),{status:400});
 const subject=await db.subject.findUniqueOrThrow({where:{id:t.subjectId}});const faculty=await db.user.findUniqueOrThrow({where:{id:t.facultyId}});
 if(subject.courseId!==t.courseId||subject.semester!==t.semester||faculty.role!=='FACULTY') throw Object.assign(new Error('Invalid subject or faculty assignment'),{status:400});
 const created=await db.$transaction(async tx=>{
 // Serialize schedule creation using the course row and faculty row.
 await tx.$queryRaw`SELECT id FROM Course ORDER BY id FOR UPDATE`;
 const existing=await tx.timetable.findMany({where:{day:t.day}});
 if(existing.some(e=>overlaps(t.startTime,t.endTime,e.startTime,e.endTime)&&(e.facultyId===t.facultyId||e.room===t.room||(e.courseId===t.courseId&&e.semester===t.semester)))) throw Object.assign(new Error('Faculty, room, or class has a conflicting lecture'),{status:409});
 return tx.timetable.create({data:t});
 });res.status(201).json(created);
});
app.patch('/api/institution',permit('departments'),async(req,res)=>{
 const logo=z.string().max(700000).refine(v=>v==='' || /^\/[A-Za-z0-9_\/-]+\.(png|jpe?g|webp)$/i.test(v) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),'Use a local PNG/JPG/WebP path or uploaded image');
 const fields=z.object({name:z.string().trim().min(2).max(150),address:z.string().trim().max(1000),email:z.union([z.email(),z.literal('')]),phone:z.string().trim().max(40),website:z.union([z.url().refine(v=>v.startsWith('https://'),'Use an HTTPS website'),z.literal('')]),logoUrl:logo,academicYear:z.string().regex(/^\d{4}[–-]\d{2,4}$/),receiptNote:z.string().max(500),paymentUpiId:z.string().trim().max(320).refine(v=>!v||/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(v),'Enter a valid UPI ID').optional(),paymentBankDetails:z.string().max(2000).optional(),paymentInstructions:z.string().max(1000).optional(),paymentQrUrl:logo.nullable().optional()}).parse(req.body);
 res.json(await db.institution.upsert({where:{id:'college'},create:{...defaultInstitution(),...fields,id:'college'},update:fields}));
});
app.post('/api/subjects',permit('departments'),async(req,res)=>{
 const input=z.object({name:z.string().trim().min(2).max(100),code:z.string().trim().min(2).max(30),courseId:id,semester}).parse(req.body);
 res.status(201).json(await db.subject.create({data:input}));
});
app.post('/api/staff',permit('departments'),async(req,res)=>{
 const input=z.object({name:z.string().trim().min(2).max(150),email:z.email(),password:z.string().min(12).max(128),role:z.enum(['ACCOUNTANT','FACULTY'])}).parse(req.body);
 const created=await db.user.create({data:{name:input.name,email:input.email.toLowerCase(),role:input.role,passwordHash:await bcrypt.hash(input.password,12)}});
 res.status(201).json(safeUser(created));
});
app.post('/api/departments',permit('departments'),async(req,res)=>{const d=z.object({name:z.string().min(2).max(100),code:z.string().min(2).max(12)}).parse(req.body);res.status(201).json(await db.department.create({data:d}));});
app.post('/api/courses',permit('departments'),async(req,res)=>{const c=z.object({name:z.string().min(2).max(100),departmentId:id}).parse(req.body);res.status(201).json(await db.course.create({data:c}));});
app.post('/api/fee-structures',permit('structures'),async(req,res)=>{
 const f=z.object({courseId:id,semester,tuition:money,exam:money,library:money,lab:money}).parse(req.body);
 res.json(await db.feeStructure.upsert({where:{courseId_semester:{courseId:f.courseId,semester:f.semester}},create:f,update:f}));
});
app.patch('/api/users/:id/role',permit('departments'),async(req:AuthRequest,res)=>{
 const {role}=z.object({role:z.enum(['ADMIN','ACCOUNTANT','FACULTY'])}).parse(req.body);
 if(req.params.id===req.user!.id) throw Object.assign(new Error('You cannot change your own role'),{status:400});
 const target=await db.user.findUniqueOrThrow({where:{id:String(req.params.id)}});if(target.role==='STUDENT') throw Object.assign(new Error('Student identities cannot be converted to staff'),{status:400});
 await db.$transaction([db.user.update({where:{id:target.id},data:{role}}),db.session.deleteMany({where:{userId:target.id}})]);res.json({ok:true});
});
app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found'}));
if(production && !process.env.VERCEL){app.use(express.static(path.resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));}
app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
 if(err instanceof z.ZodError){res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});return;}
 if(err instanceof Prisma.PrismaClientKnownRequestError){res.status(err.code==='P2002'?409:err.code==='P2025'?404:400).json({error:err.code==='P2002'?'A record with these details already exists':err.code==='P2025'?'Record not found':'Invalid related record'});return;}
 const e=err as {status?:number;message?:string};const status=e.status||500;if(status===500)console.error(err);res.status(status).json({error:status===500?'An unexpected server error occurred':e.message});
});

export { db };
export default app;
