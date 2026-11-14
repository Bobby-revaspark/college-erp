import { Check, Download, Printer } from 'lucide-react';
import { Button, Badge } from './components/ui';
import { CollegeLogo, type Institution } from './institution';
import type { Entity } from './data';
export const currency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
export function receiptFields(transaction: Entity, student: Entity) {
    return [
        ['Receipt number', transaction.receiptNumber], ['Payment date', new Date(transaction.date).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata',day: '2-digit', month: 'long', year: 'numeric' })], ['Student name', student.name], ['Enrollment number', student.enrollment], ['Course / semester', `${student.courseName || student.course?.name || '—'} / Semester ${student.semester || '—'}`], ['Payment method', String(transaction.mode).replaceAll('_', ' ')], ['Transaction reference', transaction.transactionId || 'Cash payment'], ['Amount paid', currency(transaction.amount)], ['Balance after this payment', currency(transaction.balanceAfter)],
    ] as [
        string,
        string
    ][];
}
async function logoForPdf(url: string) { if (!url)
    return null; if (!url.startsWith('data:image/') && (!url.startsWith('/') || url.startsWith('//')))
    return null; return new Promise<string | null>(resolve => { const image = new Image(); image.onload = () => { try {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return resolve(null);
    ctx.drawImage(image, 0, 0);
    resolve(canvas.toDataURL('image/png'));
}
catch {
    resolve(null);
} }; image.onerror = () => resolve(null); image.src = url; }); }
export async function downloadReceipt(institution: Institution, transaction: Entity, student: Entity) { const { jsPDF } = await import('jspdf'); const doc = new jsPDF(); const logo = await logoForPdf(institution.logoUrl); let x = 18; if (logo) {
    const props = doc.getImageProperties(logo);
    const ratio = props.width / props.height;
    const width = ratio >= 1 ? 22 : 22 * ratio;
    const height = ratio >= 1 ? 22 / ratio : 22;
    doc.addImage(logo, 'PNG', 18, 18, width, height);
    x = 47;
} doc.setTextColor(30, 67, 54); doc.setFontSize(19); const collegeNameLines = doc.splitTextToSize(institution.name, 190 - x); doc.text(collegeNameLines, x, 25); doc.setFontSize(9); doc.setTextColor(90, 108, 91); let y = Math.max(38, 25 + collegeNameLines.length * 8); for (const line of [institution.address, [institution.email, institution.phone].filter(Boolean).join(' | '), institution.website].filter(Boolean)) {
    const lines = doc.splitTextToSize(line, 172);
    if (y + lines.length * 5 > 250) {
        doc.addPage();
        y = 25;
    }
    doc.text(lines, 18, y);
    y += lines.length * 5;
} y += 5; doc.setDrawColor(210, 222, 210); doc.line(18, y, 192, y); y += 12; doc.setFontSize(15); doc.setTextColor(30, 67, 54); doc.text('PAID RECEIPT', 18, y); doc.setFontSize(10); doc.text(Number(transaction.balanceAfter) === 0 ? 'Fees paid in full' : 'Partial payment recorded', 192, y, { align: 'right' }); y += 15; for (const [label, value] of receiptFields(transaction, student)) {
    const text=String(value).replaceAll('₹','INR ');
    doc.setFontSize(label==='Amount paid'?14:10);
    const lines=doc.splitTextToSize(text,105);
    if(y+lines.length*5>265){doc.addPage();y=25;}
    doc.setFontSize(9);doc.setTextColor(105,122,101);doc.text(label,18,y);
    doc.setTextColor(42,65,43);doc.setFontSize(label==='Amount paid'?14:10);
    doc.text(lines, 85, y);
    y += Math.max(10, lines.length * 5 + 4);
} y += 6; doc.setDrawColor(210, 222, 210); doc.line(18, y, 192, y); y += 10; doc.setFontSize(9); doc.setTextColor(105, 122, 101); const noteLines = doc.splitTextToSize(institution.receiptNote || 'Thank you. Please retain this receipt for your records.', 172); if (y + noteLines.length * 5 > 268) {
    doc.addPage();
    y = 25;
} doc.text(noteLines, 18, y); doc.setFontSize(8); doc.text('Payment verified and recorded by the college. Electronic transfers are processed outside this portal.', 18, 282); doc.save(`receipt-${transaction.receiptNumber}.pdf`); }
export function ReceiptPreview({ institution, transaction, student, onDownload }: {
    institution: Institution;
    transaction: Entity;
    student: Entity;
    onDownload: () => Promise<void>;
}) { return <><article className="receipt-document"><header className="receipt-college"><CollegeLogo institution={institution}/><div><h2>{institution.name}</h2>{institution.address && <p>{institution.address}</p>}{(institution.email || institution.phone) && <p>{[institution.email, institution.phone].filter(Boolean).join(' · ')}</p>}{institution.website && <p>{institution.website}</p>}</div></header><div className="receipt-title"><div><span className="eyebrow">PAYMENT ACKNOWLEDGEMENT</span><h3>Paid receipt</h3></div><Badge tone={Number(transaction.balanceAfter) === 0 ? 'green' : 'amber'}><Check size={12}/>{Number(transaction.balanceAfter) === 0 ? 'Paid in full' : 'Partial payment'}</Badge></div><dl className="receipt-fields">{receiptFields(transaction, student).map(([label, value]) => <div key={label} className={label === 'Amount paid' ? 'receipt-amount' : ''}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="receipt-note">{institution.receiptNote || 'Thank you. Please retain this receipt for your records.'}</p><small className="receipt-disclaimer">Payment verified and recorded by the college. Electronic transfers are processed outside this portal.</small></article><div className="receipt-actions"><Button secondary onClick={() => window.print()}><Printer size={15}/>Print receipt</Button><Button onClick={() => void onDownload()}><Download size={15}/>Download PDF</Button></div></>; }
