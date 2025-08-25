import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

const OPS = {
  is: 'is',
  is_not: 'is_not',
  in: 'in',
  not_in: 'not_in',
  before: 'before',
  after: 'after',
  between: 'between',
};

export default function FilterBuilder({ schema, value, onChange, i18n }) {
  const [editing, setEditing] = useState({ field: '', op: 'is', v: '' });
  const filters = value?.all || [];

  const field = schema.find(f => f.id === editing.field) || schema[0];

  function addFilter() {
    if (!editing.field) return;
    const next = { field: editing.field, op: editing.op, value: editing.v };
    onChange?.({ all: [...filters, next] });
    setEditing({ field: '', op: 'is', v: '' });
  }
  
  function removeFilter(idx) {
    const copy = [...filters]; 
    copy.splice(idx, 1);
    onChange?.({ all: copy });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {/* current pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
            <span className="font-medium">{schema.find(s=>s.id===f.field)?.label}</span>
            <span>•</span>
            <span>{i18n.op[f.op] || f.op}</span>
            <span>•</span>
            <span className="text-gray-600">{Array.isArray(f.value) ? f.value.join(', ') : String(f.value)}</span>
            <button className="ml-1 p-1 hover:text-red-600" onClick={()=>removeFilter(i)} aria-label="Remove">
              <X size={14}/>
            </button>
          </span>
        ))}
        {filters.length === 0 && <span className="text-sm text-gray-500">{i18n.empty}</span>}
      </div>

      {/* editor row */}
      <div className="grid grid-cols-12 gap-2">
        <select className="col-span-4 rounded-md border px-3 py-2"
                value={editing.field}
                onChange={e=>setEditing(s=>({ ...s, field: e.target.value }))}>
          <option value="">{i18n.select_field}</option>
          {schema.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        <select className="col-span-3 rounded-md border px-3 py-2"
                value={editing.op}
                onChange={e=>setEditing(s=>({ ...s, op: e.target.value }))}>
          {Object.keys(OPS).map(op => <option key={op} value={op}>{i18n.op[op]}</option>)}
        </select>

        <input className="col-span-4 rounded-md border px-3 py-2"
               placeholder={i18n.value_placeholder}
               value={editing.v}
               onChange={e=>setEditing(s=>({ ...s, v: e.target.value }))}/>

        <button className="col-span-1 rounded-md bg-primary-600 text-white px-3 py-2"
                onClick={addFilter}>{i18n.add}</button>
      </div>
    </div>
  );
}
