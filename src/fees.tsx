import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, ReceiptText, Wallet } from 'lucide-react';
import { Button, Badge } from './components/ui';
import { today, type Data, type Entity } from './data';
import type { Institution } from './institution';
import { currency, downloadReceipt, ReceiptPreview } from './receipts';
export function transactionWithBalance(transaction: Entity, data: Data): Entity { if (transaction.balanceAfter !== undefined && transaction.balanceAfter !== null)
    return { ...transaction, balanceAfter: Number(transaction.balanceAfter) }; const student = data.students.find(s => s.id === transaction.studentId); const ledger = data.transactions.filter(t => t.studentId === transaction.studentId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id)); let collected = 0; for (const item of ledger) {
    collected += Number(item.amount);
    if (item.id === transaction.id)
        break;
} return { ...transaction, balanceAfter: Math.max(0, Number(student?.totalFee || 0) - collected) }; }
export function FeeStatement({ student, data, onCollect, onReceipt }: {
    student: Entity;
    data: Data;
    onCollect?: () => void;
    onReceipt: (t: Entity) => void;
}) { const due = Math.max(0, Number(student.totalFee) - Number(student.paid)); const payments = data.transactions.filter(t => t.studentId === student.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); const course = data.courses.find(c => c.id === student.courseId); return <div className="fee-statement"><div className="statement-heading"><div><span className="eyebrow">FEE STATEMENT · NOT A PAYMENT RECEIPT</span><h2>{student.name}</h2><p>{student.enrollment} · {course?.name || 'Course not assigned'} · Semester {student.semester}</p></div><Badge tone={due ? 'amber' : 'green'}>{due ? 'Outstanding balance' : 'Paid in full'}</Badge></div><div className="mini-stats statement-stats"><div>Total fees<b>{currency(student.totalFee)}</b></div><div>Paid to date<b>{currency(student.paid)}</b></div><div>Outstanding<b className={due ? 'amber-text' : ''}>{currency(due)}</b></div></div><div className="statement-context"><Wallet size={17}/><p>{due ? 'Review this statement before recording a payment. Full and partial collections are supported.' : 'There is no outstanding balance. Your past payment receipts are available below.'}</p></div><h3>Payment history</h3>{payments.length ? <div className="table-scroll" role="region" tabIndex={0} aria-label="Student payment history"><table><thead><tr><th>Receipt</th><th>Date</th><th>Paid</th><th>Balance after payment</th><th /></tr></thead><tbody>{payments.map(t => { const enriched = transactionWithBalance(t, data); return <tr key={t.id}><td>{t.receiptNumber}</td><td>{new Date(t.date).toLocaleDateString('en-IN')}</td><td>{currency(t.amount)}</td><td>{currency(enriched.balanceAfter)}</td><td><button className="text-btn" onClick={() => onReceipt(enriched)}><Eye size={14}/>View receipt</button></td></tr>; })}</tbody></table></div> : <p className="statement-empty">No payments recorded yet. This statement is unpaid.</p>}{onCollect && due > 0 && <div className="form-footer"><Button onClick={onCollect}>Collect payment<ArrowRight size={15}/></Button></div>}</div>; }
type PaymentDraft = {
    studentId: string;
    amount: number;
    mode: string;
    date: string;
    transactionId: string;
    requestId: string;
};
export function PaymentWorkflow({ data, institution, initialStudent, onRecord, onReceipt, notify }: {
    data: Data;
    institution: Institution;
    initialStudent?: Entity | null;
    onRecord: (draft: PaymentDraft) => Promise<Entity>;
    onReceipt: (t: Entity) => void;
    notify: (message: string) => void;
}) {
    const [step, setStep] = useState(initialStudent ? 'statement' : 'select');
    const [studentId, setStudentId] = useState(initialStudent?.id || '');
    const [draft, setDraft] = useState({ amount: '', mode: 'UPI', date: today(), transactionId: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [attempted, setAttempted] = useState(false);
    const [transaction, setTransaction] = useState<Entity | null>(null);
    const requestId = useRef('');
    const inFlight = useRef(false);
    const student = data.students.find(s => s.id === studentId);
    const due = student ? Math.max(0, Number(student.totalFee) - Number(student.paid)) : 0;
    const course = data.courses.find(c => c.id === student?.courseId);
    const studentForReceipt = student ? { ...student, courseName: course?.name } : undefined;
    async function download(t: Entity) { if (!studentForReceipt)
        return; try {
        await downloadReceipt(institution, t, studentForReceipt);
        notify('Receipt PDF downloaded');
    }
    catch {
        notify('Payment is saved. PDF download failed; the receipt is available in payment history.');
    } }
    const update = (key: keyof typeof draft, value: string) => { setDraft(v => ({ ...v, [key]: value })); setError(''); };
    return <div className="payment-workflow"><ol className="payment-steps" aria-label="Payment progress">{['View fees', 'Payment details', 'Review & record', 'Receipt'].map((label, i) => <li key={label} className={i <= ({ select: 0, statement: 0, details: 1, review: 2, receipt: 3 }[step] || 0) ? 'active' : ''}><span>{i + 1}</span>{label}</li>)}</ol>
 {step === 'select' && <><p className="muted">Choose a student and review their fees before recording an existing payment.</p><label>Student<select value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Select student</option>{data.students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.enrollment}</option>)}</select></label><div className="form-footer"><Button disabled={!studentId} onClick={() => setStep('statement')}>View fees<ArrowRight size={15}/></Button></div></>}
 {step === 'statement' && student && <><FeeStatement student={student} data={data} onReceipt={onReceipt} onCollect={() => { setError(''); setStep('details'); }}/>{!initialStudent && <button className="text-btn" onClick={() => setStep('select')}><ArrowLeft size={14}/>Choose another student</button>}</>}
 {step === 'details' && student && <form onSubmit={e => { e.preventDefault(); setError(''); const amount = Number(draft.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > due)
        return setError('Enter a payment amount within the outstanding balance.'); if (Math.abs(amount * 100 - Math.round(amount * 100)) > .00001)
        return setError('Use no more than two decimal places.'); if (draft.mode !== 'CASH' && !draft.transactionId.trim())
        return setError('A transaction reference is required for digital payments.'); requestId.current = crypto.randomUUID(); setAttempted(false); setStep('review'); }}><div className="payment-balance"><span>{student.name} · Outstanding balance</span><strong>{currency(due)}</strong></div><p className="payment-record-note">Record an existing payment received by the college. This portal does not transfer money or charge a card.</p><div className="form-grid"><label>Payment amount (INR)<input type="number" required min="0.01" max={due} step="0.01" value={draft.amount} onChange={e => update('amount', e.target.value)}/></label><label>Payment method<select value={draft.mode} onChange={e => update('mode', e.target.value)}><option value="UPI">UPI</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CARD">Card</option></select></label><label>Payment date<input type="date" required max={today()} value={draft.date} onChange={e => update('date', e.target.value)}/></label><label>Transaction reference {draft.mode === 'CASH' ? '(optional)' : '(required)'}<input required={draft.mode !== 'CASH'} maxLength={120} value={draft.transactionId} onChange={e => update('transactionId', e.target.value)} placeholder={draft.mode === 'CASH' ? 'Cash receipt reference' : 'UPI / bank / card reference'}/></label></div>{error && <p role="alert" className="error">{error}</p>}<div className="workflow-actions"><Button secondary onClick={() => setStep('statement')}><ArrowLeft size={14}/>Back to fees</Button><Button type="submit">Review payment<ArrowRight size={14}/></Button></div></form>}
 {step === 'review' && student && <><div className="payment-review"><span className="eyebrow">CONFIRM BEFORE RECORDING</span><h2>{currency(Number(draft.amount))}</h2><p>Existing payment received from {student.name}</p><dl><div><dt>Enrollment</dt><dd>{student.enrollment}</dd></div><div><dt>Method</dt><dd>{draft.mode.replaceAll('_', ' ')}</dd></div><div><dt>Date</dt><dd>{new Date(draft.date + 'T12:00:00').toLocaleDateString('en-IN')}</dd></div><div><dt>Transaction reference</dt><dd>{draft.transactionId || 'Cash payment'}</dd></div><div><dt>Balance after recording</dt><dd>{currency(due - Number(draft.amount))}</dd></div></dl></div><p className="payment-record-note">Confirm only after you have verified that the college received this payment.</p>{error && <p role="alert" className="error payment-error">{error} Retry sends the same payment reference safely. You may also close this window and check payment history.</p>}<div className="workflow-actions">{!attempted && <Button secondary disabled={saving} onClick={() => setStep('details')}><ArrowLeft size={14}/>Edit details</Button>}<Button disabled={saving} onClick={async () => { if (inFlight.current)
        return; inFlight.current = true; setSaving(true); setError(''); setAttempted(true); try {
        const result = await onRecord({ studentId, amount: Number(draft.amount), mode: draft.mode, date: draft.date, transactionId: draft.transactionId.trim(), requestId: requestId.current });
        setTransaction(result);
        setStep('receipt');
        void download(result);
    }
    catch (e) {
        setError((e as Error).message || 'Could not confirm this payment.');
    }
    finally {
        inFlight.current = false;
        setSaving(false);
    } }}><Check size={15}/>{saving ? 'Recording…' : attempted ? 'Retry same payment' : 'Confirm & record payment'}</Button></div></>}
 {step === 'receipt' && transaction && studentForReceipt && <><div className="payment-success"><Check size={18}/><div><b>Payment recorded successfully</b><p>{Number(transaction.balanceAfter) === 0 ? 'All fees are now paid.' : 'Partial payment saved.'} Remaining balance: {currency(transaction.balanceAfter)}</p></div></div><ReceiptPreview institution={institution} transaction={transaction} student={studentForReceipt} onDownload={() => download(transaction)}/></>}
 </div>;
}
