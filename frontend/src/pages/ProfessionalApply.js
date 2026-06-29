// frontend/src/pages/ProfessionalApply.js
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Award, CheckCircle } from 'lucide-react';
import { professionalAPI } from '../utils/api';

const FIELDS = ['Legal','Finance','Health','Engineering','Accounting','Architecture','IT','Education','Other'];

export default function ProfessionalApply() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ field: '', credentials: '', experienceYears: '', consultationFee: '', availableHours: '' });
  const [doc, setDoc]   = useState(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: (fd) => professionalAPI.apply(fd),
    onSuccess:  () => setDone(true),
  });

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (doc) fd.append('verificationDoc', doc);
    mutation.mutate(fd);
  };

  if (done) return (
    <div className="flex flex-col items-center justify-center min-h-full gap-4 text-center p-6" style={{ background: 'var(--tg-bg)' }}>
      <CheckCircle size={48} style={{ color: 'var(--tg-success)' }} />
      <p className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>ማመልከቻ ተቀብሏል!</p>
      <p className="text-sm am" style={{ color: 'var(--tg-hint)' }}>አስተዳዳሪ ሲያረጋግጥ ይነገርዎታል።</p>
    </div>
  );

  return (
    <div className="page pb-8">
      <div className="px-4 pt-6 pb-4 text-center">
        <Award size={32} style={{ color: 'var(--tg-button)', margin: '0 auto 8px' }} />
        <h1 className="text-lg font-bold am" style={{ color: 'var(--tg-text)' }}>Apply as Verified Professional</h1>
      </div>
      <div className="px-4 space-y-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Professional Field *</label>
          <select value={form.field} onChange={(e) => set('field')(e.target.value)} className="input">
            <option value="">Select field...</option>
            {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Credentials & Qualifications *</label>
          <textarea value={form.credentials} onChange={(e) => set('credentials')(e.target.value)}
                    className="input am" rows={3} placeholder="Describe your qualifications..." />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Years of Experience *</label>
          <input type="number" value={form.experienceYears} onChange={(e) => set('experienceYears')(e.target.value)}
                 className="input" placeholder="5" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Consultation Fee (ETB)</label>
          <input type="number" value={form.consultationFee} onChange={(e) => set('consultationFee')(e.target.value)}
                 className="input" placeholder="500" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Available Hours</label>
          <input value={form.availableHours} onChange={(e) => set('availableHours')(e.target.value)}
                 className="input" placeholder="Mon-Fri 9am-5pm EAT" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tg-hint)' }}>Credential Document (PDF/Image)</label>
          <input type="file" accept="image/*,.pdf" onChange={(e) => setDoc(e.target.files?.[0])}
                 className="text-sm" style={{ color: 'var(--tg-hint)' }} />
        </div>
        <button onClick={handleSubmit}
                disabled={!form.field || !form.credentials || !form.experienceYears || mutation.isPending}
                className="btn-primary w-full">
          {mutation.isPending ? '...' : 'Submit Application'}
        </button>
      </div>
    </div>
  );
}
