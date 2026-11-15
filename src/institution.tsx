import { academicYear } from './lib/calendar';
import { useEffect, useState } from 'react';
import { GraduationCap, Upload, Save, RotateCcw } from 'lucide-react';
import { Button } from './components/ui';
export type Institution = {
    id: string;
    name: string;
    address: string;
    email: string;
    phone: string;
    website: string;
    logoUrl: string;
    academicYear: string;
    receiptNote: string; paymentUpiId?:string;paymentBankDetails?:string;paymentInstructions?:string;paymentQrUrl?:string|null;
};
export { academicYear } from './lib/calendar';
export const defaultInstitution = (): Institution => ({ id: 'college', name: 'Gandhi P.R. College', address: '', email: '', phone: '', website: '', logoUrl: '/college-logo.png', academicYear: academicYear(), receiptNote: 'Thank you. Please retain this receipt for your records.',paymentUpiId:'',paymentBankDetails:'',paymentInstructions:'',paymentQrUrl:'' });
export function CollegeLogo({ institution, className = '' }: {
    institution: Institution;
    className?: string;
}) { const [broken, setBroken] = useState(false); useEffect(() => setBroken(false), [institution.logoUrl]); return institution.logoUrl && !broken ? <img src={institution.logoUrl} className={'college-logo ' + (institution.logoUrl === '/college-logo.png' ? 'college-banner ' : '') + className} alt={institution.name + ' logo'} onError={() => setBroken(true)}/> : <span className={'college-logo logo-fallback ' + className} aria-label="College logo placeholder"><GraduationCap aria-hidden="true" size={25}/></span>; }
export function InstitutionForm({ institution, onSave, saving }: {
    institution: Institution;
    onSave: (settings: Institution) => Promise<boolean>;
    saving: boolean;
}) { const [draft, setDraft] = useState(institution); const [error, setError] = useState(''); useEffect(() => setDraft(institution), [institution]); const update = (key: keyof Institution, value: string) => setDraft(d => ({ ...d, [key]: value })); return <form className="institution-form" onSubmit={async (e) => { e.preventDefault(); setError(''); if (draft.logoUrl && !(/^\/[A-Za-z0-9_\/-]+\.(png|jpe?g|webp)$/i.test(draft.logoUrl)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(draft.logoUrl))) {
    setError('Use a local path such as /college-logo.png or upload a logo.');
    return;
} if(draft.website&&!draft.website.startsWith('https://')){setError('Use an HTTPS college website.');return;} await onSave(draft); }}><div className="branding-preview"><CollegeLogo institution={draft}/><div><b>{draft.name || 'Your college name'}</b><small>{draft.logoUrl ? 'Your college logo' : 'Placeholder icon · add your college logo below'}</small></div></div><div className="form-grid"><label>College name<input required minLength={2} maxLength={150} value={draft.name} onChange={e => update('name', e.target.value)}/></label><label>Academic year<input required maxLength={20} pattern="[0-9]{4}(-|–)[0-9]{2,4}" value={draft.academicYear} onChange={e => update('academicYear', e.target.value)}/></label><label>College address<input maxLength={1000} value={draft.address} onChange={e => update('address', e.target.value)}/></label><label>Contact email<input type="email" maxLength={150} value={draft.email} onChange={e => update('email', e.target.value)}/></label><label>Contact phone<input maxLength={40} value={draft.phone} onChange={e => update('phone', e.target.value)}/></label><label>Website<input type="url" placeholder="https://yourcollege.edu" maxLength={200} value={draft.website} onChange={e => update('website', e.target.value)}/></label><label>Logo file path<input placeholder="/college-logo.png" value={draft.logoUrl.startsWith('data:') ? 'Uploaded logo' : draft.logoUrl} readOnly={draft.logoUrl.startsWith('data:')} onChange={e => update('logoUrl', e.target.value)}/><small>Optional: place your logo at public/college-logo.png and enter /college-logo.png.</small></label><label><span><Upload size={13}/> Upload college logo</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (!file)
    return; if (file.size > 350000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    setError('Choose a PNG, JPG or WebP logo up to 350 KB.');
    e.target.value = '';
    return;
} const reader = new FileReader(); reader.onload = () => { update('logoUrl', String(reader.result)); setError(''); }; reader.onerror = () => setError('Could not read this logo. Please try another file.'); reader.readAsDataURL(file); }}/><small>PNG, JPG or WebP · up to 350 KB</small></label></div><h3 className="form-section">Student payment instructions</h3><p className="muted">Until you upload a genuine QR, students see a labelled demo placeholder. A submission never marks fees paid until verified by an accountant.</p><div className="form-grid"><label>College UPI ID<input placeholder="college@bank" maxLength={320} value={draft.paymentUpiId||''} onChange={e=>update('paymentUpiId',e.target.value)}/></label><label>Genuine payment QR<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>350000||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Use PNG, JPG or WebP up to350 KB.');e.target.value='';return;}const reader=new FileReader();reader.onload=()=>update('paymentQrUrl',String(reader.result));reader.readAsDataURL(file)}}/></label></div>{draft.paymentQrUrl&&<div className="qr-settings-preview"><img src={draft.paymentQrUrl} alt="Uploaded college payment QR"/><Button secondary onClick={()=>update('paymentQrUrl','')}>Remove QR</Button></div>}<label>Bank transfer details<textarea maxLength={2000} rows={4} value={draft.paymentBankDetails||''} onChange={e=>update('paymentBankDetails',e.target.value)} placeholder="Account holder, bank, account number and IFSC"/></label><label>Payment instructions<textarea maxLength={1000} rows={3} value={draft.paymentInstructions||''} onChange={e=>update('paymentInstructions',e.target.value)}/></label><label className="receipt-note-field">Receipt note<textarea maxLength={500} rows={3} value={draft.receiptNote} onChange={e => update('receiptNote', e.target.value)}/></label>{error && <p className="error" role="alert">{error}</p>}<div className="branding-actions"><Button secondary disabled={saving} onClick={() => update('logoUrl', '')}><RotateCcw size={14}/>Use placeholder</Button><Button type="submit" disabled={saving}><Save size={14}/>{saving ? 'Saving…' : 'Save college settings'}</Button></div></form>; }
