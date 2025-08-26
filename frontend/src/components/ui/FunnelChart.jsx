import { useTranslation } from 'react-i18next';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import { createNumberFormatter } from '../../lib/format';

const COLORS = {
  reached: '#3b82f6',      // Blue
  connected: '#10b981',    // Green  
  qualified: '#f59e0b',    // Amber
  booked: '#ef4444'        // Red
};

export default function FunnelChart({ data, className = "" }) {
  const { t, i18n } = useTranslation();
  const formatters = createNumberFormatter(i18n.language, 'EUR');
  
  if (!data) {
    return (
      <div className={`flex items-center justify-center h-40 text-muted-foreground ${className}`}>
        {t("common.loading")}
      </div>
    );
  }

  // Transform data for Recharts
  const chartData = [
    { 
      stage: t("pages.analytics.kpi.reached"), 
      value: data.reached || 0, 
      color: COLORS.reached,
      key: 'reached'
    },
    { 
      stage: t("pages.analytics.kpi.connected"), 
      value: data.connected || 0, 
      color: COLORS.connected,
      key: 'connected'
    },
    { 
      stage: t("pages.analytics.kpi.qualified"), 
      value: data.qualified || 0, 
      color: COLORS.qualified,
      key: 'qualified'
    },
    { 
      stage: t("pages.analytics.kpi.booked"), 
      value: data.booked || 0, 
      color: COLORS.booked,
      key: 'booked'
    }
  ];

  const total = data.reached || 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = total > 0 ? ((data.value / total) * 100) : 0;
      
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            {formatters.number(data.value)} ({formatters.percent(percentage)})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="horizontal" margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis 
            type="number" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis 
            type="category" 
            dataKey="stage" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Conversion rates */}
      <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
        {chartData.map((item, index) => {
          const nextItem = chartData[index + 1];
          const rate = nextItem && item.value > 0 
            ? ((nextItem.value / item.value) * 100).toFixed(1)
            : 0;
          
          return (
            <div key={item.key} className="text-center">
              <div className="font-medium text-foreground">
                {item.value.toLocaleString()}
              </div>
              {nextItem && (
                <div className="text-muted-foreground">
                  {rate}% → {nextItem.stage}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
