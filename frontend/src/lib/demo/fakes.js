/**
 * Centralized demo data generators for consistent fake data across components
 * Used by useLeads, Dashboard, and other components that need demo data
 */

export const generateDemoLeads = (total = 150) => {
  const rows = [];
  const statuses = ['new', 'contacted', 'qualified', 'lost'];
  const stages = ['cold', 'warm', 'hot'];
  const campaigns = ['Summer', 'Launch', 'Retarget'];
  const owners = ['Giulia', 'Marco'];
  
  for (let i = 1; i <= total; i++) {
    rows.push({
      id: `demo-${i}`,
      name: `Demo Lead ${i}`,
      phone: `+39 3${String(100000000 + i).slice(0, 8)}`,
      email: `lead${i}@example.com`,
      status: statuses[i % statuses.length],
      campaign: campaigns[i % campaigns.length],
      stage: stages[i % stages.length],
      owner: owners[i % owners.length],
      last_contact: new Date(Date.now() - i * 86400000).toISOString(),
      score: (i % 10) * 10,
    });
  }
  return rows;
};

export const generateDemoMetrics = () => ({
  calls_today: 247,
  minutes_month: 1842,
  avg_duration_sec: 186,
  contact_rate: 0.34,
  qualified_rate: 0.18,
  spend_today_cents: 2847, // €28.47
  budget_monthly_cents: 500000, // €5000
  budget_spent_month_cents: 187500, // €1875 (37.5%)
  concurrency_used: 7,
  concurrency_limit: 15
});

export const generateDemoFunnelData = () => ({
  reached: 1250,
  connected: 425,
  qualified: 76,
  booked: 23
});

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

// Additional demo generators needed by demoGate.js
export const makeLeads = generateDemoLeads;
export const makeDashboardSummary = generateDemoMetrics;
export const makeCampaigns = () => [
  { id: 1, name: 'Summer Campaign', status: 'active', budget: 5000, spent: 1875 },
  { id: 2, name: 'Launch Campaign', status: 'paused', budget: 3000, spent: 1200 },
  { id: 3, name: 'Retarget Campaign', status: 'active', budget: 2000, spent: 800 }
];
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
