/**
 * Centralized demo data generators for consistent fake data across components
 * Used by useLeads, Dashboard, and other components that need demo data
 */

export const generateDemoLeads = (total = 150) => {
  const statuses = ['new','contacted','qualified','lost'];
  const stages   = ['cold','warm','hot'];
  const owners   = ['Giulia','Marco','Luca','Sara'];
  const countries = ['IT','FR','DE','ES','GB','US','NL','BE','AT','CH'];
  const classes = ['b2b','b2c','unknown'];
  const categories = ['allowed','conditional','blocked'];
  const rows = [];
  for (let i=0;i<total;i++){
    const country_iso = countries[i % countries.length];
    const contact_class = classes[i % classes.length];
    const compliance_category = categories[i % categories.length];
    rows.push({
      id: `demo-${i+1}`,
      name: `Demo Lead ${i+1}`,
      company: i%3===0 ? `Company ${i+1}` : null,
      email: `lead${i+1}@example.com`,
      phone_e164: `+39${String(3200000000 + i).slice(0,10)}`, // E.164-like
      country_iso,
      contact_class,
      known: i%4===0,               // relazione esistente
      opt_in: contact_class==='b2c' ? (i%5===0) : null,
      national_dnc: contact_class==='b2c' ? (i%6===0 ? 'in':'not_in') : 'unknown',
      compliance_category,
      compliance_reasons: compliance_category==='blocked'
        ? ['Opt-in required not provided'] 
        : compliance_category==='conditional'
          ? ['DNC registry present: status unknown']
          : ['B2B allowed'],
      status: statuses[i % statuses.length],
      stage: stages[i % stages.length],
      campaign: ['Launch','Retarget','Summer'][i % 3],
      owner: owners[i % owners.length],
      last_contact: new Date(Date.now() - i*36e5).toISOString(),
      score: (i % 10) * 10
    });
  }
  return rows;
};

// --- Billing demo ---------------------------------------------------------
export function generateDemoBilling() {
  // Piani demo sensati: Starter 3k–5k, Pro 5k–10k
  const plans = [
    { name: 'Starter', cap: 300000, variance: 200000 }, // €3k–€5k
    { name: 'Pro',     cap: 500000, variance: 500000 }  // €5k–€10k
  ];
  const plan = plans[Math.floor(Math.random() * plans.length)];
  const monthly_cap_cents =
    plan.cap + Math.round(Math.random() * plan.variance); // 300k–1M
  const spent_ratio = 0.25 + Math.random() * 0.35;        // 25%–60%
  const spent_month_cents = Math.round(monthly_cap_cents * spent_ratio);
  return {
    plan: plan.name,
    currency: 'EUR',
    monthly_cap_cents,
    spent_month_cents,
  };
}

export const generateDemoMetrics = () => {
  const billing = generateDemoBilling();
  return {
    calls_today: 247,
    minutes_month: 1842,
    avg_duration_sec: 186,
    contact_rate: 0.34,
    qualified_rate: 0.18,
    spend_today_cents: 2847, // €28.47
    // >>> billing coerente in DEMO
    budget_monthly_cents: billing.monthly_cap_cents,
    budget_spent_month_cents: billing.spent_month_cents,
    concurrency_used: 7,
    concurrency_limit: 15
  };
};

export const generateDemoFunnelData = () => {
  // Generate realistic funnel percentages (relative to previous stage)
  const reached = 100  // Always 100% reached
  const connected = Math.floor(Math.random() * 15 + 25)  // 25-40% of reached
  const qualified = Math.floor(Math.random() * 10 + 15)  // 15-25% of reached  
  const booked = Math.floor(Math.random() * 8 + 5)       // 5-13% of reached
  
  return { reached, connected, qualified, booked }
};

export const generateDemoAgents = () => [
  { id: 1, name: 'Alice Johnson', calls: 45, conversion: 0.22 },
  { id: 2, name: 'Marco Rossi', calls: 38, conversion: 0.19 },
  { id: 3, name: 'Sarah Chen', calls: 42, conversion: 0.25 },
  { id: 4, name: 'David Miller', calls: 33, conversion: 0.15 },
  { id: 5, name: 'Elena Bianchi', calls: 29, conversion: 0.21 }
];

export const generateDemoGeoData = () => [
  { country: 'IT', calls: 156, success: 34 },
  { country: 'DE', calls: 89, success: 18 },
  { country: 'FR', calls: 67, success: 12 },
  { country: 'ES', calls: 45, success: 8 },
  { country: 'UK', calls: 38, success: 9 }
];

export const generateDemoCostSeries = (days = 30) => {
  const series = [];
  const baseDate = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i);
    
    series.push({
      date: date.toISOString().split('T')[0],
      cost_cents: Math.floor(Math.random() * 2000 + 1000), // €10-30 per day
      calls: Math.floor(Math.random() * 50 + 20)
    });
  }
  
  return series;
};

export const generateDemoTrends = (days = 7) => {
  const labels = Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  });
  
  return {
    labels,
    created: labels.map(() => Math.floor(Math.random() * 25 + 15)), // 15-40 calls
    finished: labels.map(() => Math.floor(Math.random() * 20 + 10)), // 10-30 calls
    qualified: labels.map(() => Math.floor(Math.random() * 8 + 3)), // 3-11 qualified
    contact_rate: labels.map(() => Math.floor(Math.random() * 15 + 25)) // 25-40% contact rate
  };
};

export const makeDemoKnowledgeBase = () => {
  return {
    progress: 73,
    items: [
      { 
        id: 'kb-1', 
        title: 'Product FAQs', 
        docs: 24, 
        lastUpdated: Date.now() - 86400000,
        completeness_pct: 85,
        freshness_score: 92
      },
      { 
        id: 'kb-2', 
        title: 'Pricing & Plans', 
        docs: 12, 
        lastUpdated: Date.now() - 3600000,
        completeness_pct: 67,
        freshness_score: 78
      },
      { 
        id: 'kb-3', 
        title: 'Integration Guide', 
        docs: 18, 
        lastUpdated: Date.now() - 172800000,
        completeness_pct: 91,
        freshness_score: 88
      }
    ],
    company: {
      id: 'company-demo',
      kind: 'company',
      completeness_pct: 73,
      freshness_score: 85,
      updated_at: new Date().toISOString()
    },
    offers: [
      {
        id: 'offers-demo',
        kind: 'offer_pack',
        completeness_pct: 68,
        freshness_score: 79,
        updated_at: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  };
};

// Demo generators for new campaign form components
export const demo = {
  templates(count = 6) {
    const names = ['Sales Qualification', 'Customer Support', 'Appointment Booking', 'NPS Survey', 'RFQ Process', 'Follow-up Call'];
    return Array.from({ length: count }, (_, i) => ({
      id: `tpl_${i+1}`, 
      name: names[i % names.length],
      label: names[i % names.length] // for AsyncSelect compatibility
    }));
  },
  agents(count = 8) {
    const names = ['Alice Johnson', 'Marco Rossi', 'Sarah Chen', 'David Miller', 'Elena Bianchi', 'Jean Dupont', 'Hans Mueller', 'Maria Garcia'];
    return Array.from({ length: count }, (_, i) => ({ 
      id: `ag_${i+1}`, 
      name: names[i % names.length],
      label: names[i % names.length] // for AsyncSelect compatibility
    }));
  },
  numbers(count = 5) {
    return Array.from({ length: count }, (_, i) => ({ 
      id: `num_${i+1}`, 
      e164: `+12025550${100+i}`,
      name: `+12025550${100+i}`, // for AsyncSelect compatibility
      label: `+12025550${100+i}` // for AsyncSelect compatibility
    }));
  },
  knowledgeBases(count = 6) {
    const names = ['Company Policy', 'Product Catalog', 'Sales Scripts', 'Support FAQ', 'Compliance Rules', 'Training Material'];
    return Array.from({ length: count }, (_, i) => ({ 
      id: `kb_${i+1}`, 
      name: names[i % names.length] + ` ${i+1}`,
      label: names[i % names.length] + ` ${i+1}` // for AsyncSelect compatibility
    }));
  }
};

// Additional demo generators needed by demoGate.js
export const makeLeads = generateDemoLeads;
export const makeDashboardSummary = generateDemoMetrics;

export function generateDemoCampaigns(n = 16) {
  const statuses = ['draft','active','paused','completed'];
  const names = ['Sales Qualification', 'Customer Support', 'Appointment Booking', 'NPS Survey', 'RFQ Process', 'Follow-up Call'];
  return Array.from({ length: n }).map((_, i) => ({
    id: `c_${i+1}`,
    name: names[i % names.length] + ` ${i+1}`,
    status: statuses[i % statuses.length],
    created_at: new Date(Date.now() - i*86400000).toISOString(),
    // segmento completo per filtri Leads (riusato in CampaignDetail → Leads)
    segment: {
      q: '',
      status: i % 3 === 0 ? ['new', 'contacted'] : ['qualified'],
      stage: i % 3 === 1 ? ['cold'] : ['warm', 'hot'],
      contact_class: i % 2 === 0 ? ['b2b'] : ['b2c'],
      compliance_category: i % 3 === 0 ? ['allowed'] : i % 3 === 1 ? ['conditional'] : ['blocked'],
      country_iso: i % 4 === 0 ? ['IT'] : i % 4 === 1 ? ['FR'] : i % 4 === 2 ? ['DE'] : ['ES']
    }
  }));
}

export const makeCampaigns = (params = {}) => {
  const total = params.total || 12;
  return generateDemoCampaigns(total);
};
export const makeNumbers = (params = {}) => {
  const total = params.total || 25
  const numbers = []
  
  for (let i = 1; i <= total; i++) {
    numbers.push({
      id: `num_${i}`,
      e164: `+39${String(300000000 + i).slice(0, 9)}`,
      country: 'IT',
      capabilities: ['voice', 'sms'],
      status: i % 3 === 0 ? 'suspended' : 'active',
      assigned_to: i % 4 === 0 ? 'Campaign A' : null,
      purchased_at: new Date(Date.now() - i * 86400000).toISOString(),
      carrier: 'Retell',
      source: 'agoralia',
      verified: true,
      can_inbound: true
    })
  }
  
  return numbers
}
export const makeKnowledgeBase = () => [
  { id: 1, title: 'Company Policy A', type: 'company', status: 'published' },
  { id: 2, title: 'Offer Package B', type: 'offer_pack', status: 'draft' },
  { id: 3, title: 'Company Policy C', type: 'company', status: 'published' }
];
