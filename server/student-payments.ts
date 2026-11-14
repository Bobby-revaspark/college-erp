import type {Express,Request} from 'express';
import {PrismaClient,Prisma,type User} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {isPastOrTodayDate} from './security';
type AuthRequest=Request&{user?:User};
export const paymentRequestSelect={id:true,requestId:true,studentId:true,amount:true,mode:true,transactionId:true,date:true,studentNote:true,hasProof:true,status:true,reviewerId:true,reviewNote:true,reviewedAt:true,receiptId:true,createdAt:true,updatedAt:true,student:{select:{name:true,enrollment:true}},receipt:{select:{id:true,receiptNumber:true}}} as const;
const formatted=(r:any)=>({...r,amount:Number(r.amount)});
const problem=(message:string,status=400)=>Object.assign(new Error(message),{status});
const feeStaff=(user:User)=>['ADMIN','ACCOUNTANT'].includes(user.role);
export function registerStudentPayments(app:Express,db:PrismaClient){
 app.get('/api/payment-requests',async(req:AuthRequest,res)=>{
  const user=req.user!;
  if(user.role==='FACULTY'){res.status(403).json({error:'Payment submissions are restricted to students and fee staff'});return;}
  const requests=await db.studentPaymentRequest.findMany({where:user.role==='STUDENT'?{student:{userId:user.id}}:undefined,select:paymentRequestSelect,orderBy:{createdAt:'desc'},take:200});
  res.json({requests:requests.map(formatted)});
 });
 app.get('/api/payment-requests/:id',async(req:AuthRequest,res)=>{
  const user=req.user!;const record=await db.studentPaymentRequest.findUniqueOrThrow({where:{id:String(req.params.id)},select:{...paymentRequestSelect,proof:true,student:{select:{name:true,enrollment:true,userId:true}}}});
  if(!feeStaff(user)&&!(user.role==='STUDENT'&&record.student.userId===user.id)){res.status(403).json({error:'You cannot access this payment submission'});return;}
  const {userId,...student}=record.student;res.json(formatted({...record,student}));
 });
 app.post('/api/payment-requests',async(req:AuthRequest,res)=>{
  const user=req.user!;if(user.role!=='STUDENT'){res.status(403).json({error:'Only students can submit their own payment'});return;}
  const input=z.object({requestId:z.uuid(),amount:z.number().positive().max(10_000_000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.00001,'Use at most two decimal places'),mode:z.enum(['UPI','BANK_TRANSFER']),transactionId:z.string().trim().min(4).max(120),date:z.coerce.date().refine(d=>isPastOrTodayDate(d),'Date cannot be in the future'),studentNote:z.string().trim().max(500).default(''),proof:z.string().max(700000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional()}).parse(req.body);
  const student=await db.student.findUniqueOrThrow({where:{userId:user.id}});
  const existing=await db.studentPaymentRequest.findUnique({where:{requestId:input.requestId},select:paymentRequestSelect});
  if(existing){
   if(existing.studentId!==student.id||Number(existing.amount)!==input.amount||existing.mode!==input.mode||existing.transactionId!==input.transactionId||existing.date.getTime()!==input.date.getTime())throw problem('Submission reference was already used for different details',409);
   res.json(formatted(existing));return;
  }
  const paid=await db.feeTransaction.aggregate({where:{studentId:student.id},_sum:{amount:true}});
  if(new Prisma.Decimal(input.amount).greaterThan(student.totalFee.minus(paid._sum.amount??0)))throw problem('Submitted amount exceeds your outstanding balance');
  if(await db.feeTransaction.findUnique({where:{transactionId:input.transactionId}}))throw problem('This transfer already has a fee receipt. Check payment history.',409);
  const record=await db.studentPaymentRequest.create({data:{...input,studentId:student.id,hasProof:Boolean(input.proof)},select:paymentRequestSelect});
  res.status(201).json(formatted(record));
 });
 app.post('/api/payment-requests/:id/review',async(req:AuthRequest,res)=>{
  const user=req.user!;if(!feeStaff(user)){res.status(403).json({error:'Only fee staff can verify student payments'});return;}
  const input=z.object({action:z.enum(['APPROVE','REJECT']),reviewNote:z.string().trim().max(500).default(''),confirmedReceived:z.boolean().optional()}).superRefine((v,c)=>{if(v.action==='APPROVE'&&v.confirmedReceived!==true)c.addIssue({code:'custom',message:'Confirm that the college actually received this payment'});if(v.action==='REJECT'&&v.reviewNote.length<3)c.addIssue({code:'custom',message:'Enter the reason for rejecting this submission'});}).parse(req.body);
  const target=await db.studentPaymentRequest.findUniqueOrThrow({where:{id:String(req.params.id)},select:{id:true,studentId:true}});
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM Student WHERE id = ${target.studentId} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM StudentPaymentRequest WHERE id = ${target.id} FOR UPDATE`;
   const submission=await tx.studentPaymentRequest.findUniqueOrThrow({where:{id:target.id}});
   if(submission.status==='APPROVED'){
    if(input.action!=='APPROVE')throw problem('An approved payment cannot be rejected',409);
    return {request:await tx.studentPaymentRequest.findUniqueOrThrow({where:{id:submission.id},select:paymentRequestSelect}),transaction:submission.receiptId?await tx.feeTransaction.findUnique({where:{id:submission.receiptId}}):null};
   }
   if(submission.status==='REJECTED')throw problem('This submission was already rejected; review its note or record a separately verified payment',409);
   if(input.action==='REJECT')return {request:await tx.studentPaymentRequest.update({where:{id:submission.id},data:{status:'REJECTED',reviewerId:user.id,reviewNote:input.reviewNote,reviewedAt:new Date()},select:paymentRequestSelect}),transaction:null};
   let transaction=await tx.feeTransaction.findUnique({where:{transactionId:submission.transactionId}});
   if(transaction){if(transaction.studentId!==submission.studentId||!transaction.amount.equals(submission.amount)||transaction.mode!==submission.mode)throw problem('This bank reference is already linked to another payment',409);}
   else {
    const student=await tx.student.findUniqueOrThrow({where:{id:submission.studentId}});
    const total=await tx.feeTransaction.aggregate({where:{studentId:submission.studentId},_sum:{amount:true}});
    const balance=student.totalFee.minus(total._sum.amount??0);
    if(submission.amount.greaterThan(balance))throw problem('Outstanding balance has changed. Verify excess payment/refund with the student before approving.',409);
    transaction=await tx.feeTransaction.create({data:{studentId:submission.studentId,amount:submission.amount,mode:submission.mode,transactionId:submission.transactionId,date:submission.date,recordedById:user.id,requestId:`student-request:${submission.id}`,receiptNumber:`RCP-${Date.now()}-${randomUUID().slice(0,6).toUpperCase()}`,balanceAfter:balance.minus(submission.amount)}});
   }
   const reviewed=await tx.studentPaymentRequest.update({where:{id:submission.id},data:{status:'APPROVED',reviewerId:user.id,reviewNote:input.reviewNote,reviewedAt:new Date(),receiptId:transaction.id},select:paymentRequestSelect});
   return {request:reviewed,transaction};
  });
  res.json({request:formatted(result.request),transaction:result.transaction?{...result.transaction,amount:Number(result.transaction.amount),balanceAfter:result.transaction.balanceAfter==null?null:Number(result.transaction.balanceAfter)}:null});
 });
}
