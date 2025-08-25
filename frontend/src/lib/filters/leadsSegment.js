// from FilterBuilder { all:[{field,op,value}...] } to API query params
export function leadsSegmentToQuery(segment) {
  const q = new URLSearchParams();
  if (!segment?.all?.length) return q;

  for (const f of segment.all) {
    const v = Array.isArray(f.value) ? f.value.join(',') : f.value;

    switch (f.field) {
      case 'compliance_category':
        if (f.op === 'is') q.set('compliance_category', v);
        if (f.op === 'is_not') q.set('compliance_category__ne', v);
        break;
      case 'contact_class':
        if (f.op === 'is') q.set('contact_class', v);
        if (f.op === 'is_not') q.set('contact_class__ne', v);
        break;
      case 'status':
      case 'stage':
        if (f.op === 'is') q.set(f.field, v);
        if (f.op === 'is_not') q.set(`${f.field}__ne`, v);
        if (f.op === 'in') q.set(`${f.field}__in`, v);
        if (f.op === 'not_in') q.set(`${f.field}__nin`, v);
        break;
      case 'country_iso':
        if (f.op === 'is') q.set('country_iso', v);
        if (f.op === 'is_not') q.set('country_iso__ne', v);
        if (f.op === 'in') q.set('country_iso__in', v);
        break;
      case 'created_at':
      case 'updated_at': {
        if (f.op === 'before') q.set(`${f.field}__lte`, v);
        if (f.op === 'after')  q.set(`${f.field}__gte`, v);
        if (f.op === 'between' && typeof v === 'string') {
          const [a,b] = v.split(',');
          if (a) q.set(`${f.field}__gte`, a.trim());
          if (b) q.set(`${f.field}__lte`, b.trim());
        }
        break;
      }
      default: break;
    }
  }
  return q;
}
