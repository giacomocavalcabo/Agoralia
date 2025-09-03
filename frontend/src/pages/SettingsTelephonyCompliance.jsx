import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRequirements, listSubmissions, createSubmission, uploadComplianceFile } from '../lib/complianceApi';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function SettingsTelephonyCompliance() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [provider, setProvider] = useState('twilio'); // default, oppure leggi dai provider collegati
  const [country, setCountry] = useState('IT');
  const [numberType, setNumberType] = useState('local');
  const [entity, setEntity] = useState('business'); // 'individual' | 'business'
  const [uploading, setUploading] = useState(false);

  const reqQ = useQuery({
    queryKey: ['compliance.requirements', provider, country, numberType, entity],
    queryFn: () => getRequirements({ provider, country, numberType, entity })
  });

  const subsQ = useQuery({ queryKey: ['compliance.submissions'], queryFn: listSubmissions });

  const createMut = useMutation({ mutationFn: createSubmission, onSuccess: () => qc.invalidateQueries(['compliance.submissions']) });

  const onUpload = async (submissionId, file, kind) => {
    setUploading(true);
    try { await uploadComplianceFile({ submissionId, file, kind }); qc.invalidateQueries(['compliance.submissions']); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Compliance / KYC</h1>

      {/* Selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select className="select select-bordered" value={provider} onChange={e=>setProvider(e.target.value)}>
          <option value="twilio">Twilio</option>
          <option value="telnyx">Telnyx</option>
        </select>
        <input className="input input-bordered" value={country} onChange={e=>setCountry(e.target.value.toUpperCase())} placeholder="Country (e.g. IT)" />
        <select className="select select-bordered" value={numberType} onChange={e=>setNumberType(e.target.value)}>
          <option value="local">Local</option>
          <option value="mobile">Mobile</option>
          <option value="toll_free">Toll-free</option>
        </select>
        <select className="select select-bordered" value={entity} onChange={e=>setEntity(e.target.value)}>
          <option value="business">Business</option>
          <option value="individual">Individual</option>
        </select>
      </div>

      {/* Requirements */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Requisiti</h2>
          {reqQ.isLoading ? <div className="text-sm opacity-70">Loading…</div> :
           reqQ.error ? <div className="text-error">Failed loading requirements</div> :
           <ul className="list-disc pl-6">
             {(reqQ.data?.requirements || []).map((r,i)=>(
               <li key={i}><span className="font-medium">{r.code}</span> — {r.label}</li>
             ))}
           </ul>}
        </div>
      </div>

      {/* Submissions */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title">Sottomissioni</h2>
            <button
              className="btn btn-primary"
              onClick={()=>createMut.mutate({ provider, country, number_type:numberType, entity })}
              disabled={createMut.isPending}
            >{t('compliance.new_submission')}</button>
          </div>

          {subsQ.isLoading ? <div className="text-sm opacity-70">Loading…</div> :
           subsQ.error ? <div className="text-error">Failed loading submissions</div> :
           <div className="overflow-x-auto">
             <table className="table">
               <thead><tr><th>ID</th><th>Provider</th><th>Paese</th><th>Tipo</th><th>Entità</th><th>Status</th><th>Upload</th></tr></thead>
               <tbody>
               {(subsQ.data?.items || []).map(s=>(
                 <tr key={s.id}>
                   <td className="font-mono">{s.id.slice(0,8)}</td>
                   <td>{s.provider}</td>
                   <td>{s.country}</td>
                   <td>{s.number_type}</td>
                   <td>{s.entity}</td>
                   <td><span className={`badge ${s.status === 'approved' ? 'badge-success' : s.status==='rejected' ? 'badge-error' : 'badge-ghost'}`}>{s.status}</span></td>
                   <td>
                     <label className="btn btn-sm">
                       {uploading ? 'Uploading…' : 'Upload file'}
                       <input type="file" className="hidden" onChange={e=>{
                         const f = e.target.files?.[0]; if(!f) return;
                         onUpload(s.id, f, 'document');
                       }} />
                     </label>
                   </td>
                 </tr>
               ))}
               </tbody>
             </table>
           </div>}
        </div>
      </div>
    </div>
  );
}
