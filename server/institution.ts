import { collegeDate } from './security';
export function defaultInstitution() {
 const [year,month] = collegeDate().split('-').map(Number);
 const start = month >= 7 ? year : year - 1;
 return {
  id: 'college', name: 'Greenfield College', address: '', email: '', phone: '', website: '',
  logoUrl: '/college-logo.png', academicYear: `${start}–${String(start + 1).slice(-2)}`,
  receiptNote: 'This receipt confirms a recorded payment. Please retain it for your records.',
  paymentUpiId: '', paymentBankDetails: '', paymentInstructions: '', paymentQrUrl: '',
 };
}
export function paymentReceiptBalances<T extends { id:string;studentId:string;amount:unknown;balanceAfter?:unknown;date:Date;createdAt:Date }>(transactions:T[], totals:Map<string,number>) {
 const paid = new Map<string,number>();
 const balances = new Map<string,number>();
 for (const t of [...transactions].sort((a,b)=>a.date.getTime()-b.date.getTime() || a.createdAt.getTime()-b.createdAt.getTime() || a.id.localeCompare(b.id))) {
  paid.set(t.studentId,Math.round(((paid.get(t.studentId)||0)+Number(t.amount))*100)/100);
  balances.set(t.id,t.balanceAfter!=null?Number(t.balanceAfter):Math.max(0,Math.round(((totals.get(t.studentId)||0)-paid.get(t.studentId)!)*100)/100));
 }
 return balances;
}
