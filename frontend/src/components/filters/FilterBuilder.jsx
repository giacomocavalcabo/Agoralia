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
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      {/* current pills - right side */}
      <div className="flex flex-wrap gap-2 mb-3">
        {filters.map((f, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs bg-blue-50 border-blue-200">
            <span className="font-medium text-blue-800">{schema.find(s=>s.id===f.field)?.label}</span>
            <span className="text-blue-600">•</span>
            <span className="text-blue-700">{i18n.op[f.op] || f.op}</span>
            <span className="text-blue-600">•</span>
            <span className="text-blue-600">{Array.isArray(f.value) ? f.value.join(', ') : String(f.value)}</span>
            <button className="ml-1 p-0.5 hover:text-red-600 hover:bg-red-50 rounded" onClick={()=>removeFilter(i)} aria-label="Remove">
              <X size={12}/>
            </button>
          </span>
        ))}
        {filters.length === 0 && <span className="text-xs text-gray-400">{i18n.empty}</span>}
      </div>

      {/* editor row - left side, more compact */}
      <div className="grid grid-cols-12 gap-2">
        <select className="col-span-4 rounded border px-2 py-1.5 text-sm"
                value={editing.field}
                onChange={e=>setEditing(s=>({ ...s, field: e.target.value }))}>
          <option value="">{i18n.select_field}</option>
          {schema.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        <select className="col-span-3 rounded border px-2 py-1.5 text-sm"
                value={editing.op}
                onChange={e=>setEditing(s=>({ ...s, op: e.target.value }))}>
          {Object.keys(OPS).map(op => <option key={op} value={op}>{i18n.op[op]}</option>)}
        </select>

        <input className="col-span-4 rounded border px-2 py-1.5 text-sm"
               placeholder={i18n.value_placeholder}
               value={editing.v}
               onChange={e=>setEditing(s=>({ ...s, v: e.target.value }))}/>

        <button className="col-span-1 rounded bg-blue-600 text-white px-2 py-1.5 text-sm hover:bg-blue-700"
                onClick={addFilter}>{i18n.add}</button>
      </div>
    </div>
  );
}
