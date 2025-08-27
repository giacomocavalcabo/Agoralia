import { useTranslation } from 'react-i18next';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { createNumberFormatter } from '../../lib/format';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function OutcomesChart({ 
  data = {}, 
  className = "",
  height = 300 
}) {
  const { t, i18n } = useTranslation();
  const formatters = createNumberFormatter(i18n.language, 'EUR');
  
  if (!data || !data.by_reason || data.by_reason.length === 0) {
    return (
      <div className={`flex items-center justify-center h-40 text-muted-foreground ${className}`}>
        {t("common.no_data")}
      </div>
    );
  }

  // Transform data for charts
  const barData = data.by_reason.map((item, index) => ({
    reason: t(`pages.analytics.outcomes.reasons.${item.reason}`, { defaultValue: item.reason }),
    count: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const pieData = [
            { name: t('analytics.outcomes.booked'), value: data.totals?.booked || 0, color: '#10b981' },
        { name: t('analytics.outcomes.qualified'), value: data.totals?.qualified || 0, color: '#3b82f6' },
        { name: t('analytics.outcomes.failed'), value: data.totals?.failed || 0, color: '#ef4444' }
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.reason || data.name}</p>
          <p className="text-sm text-muted-foreground">
            {t('common.count')}: {formatters.number(data.count || data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Reasons Breakdown */}
        <div>
          <h3 className="text-lg font-semibold mb-4">
            {t('analytics.outcomes.by_reason')}
          </h3>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="reason" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Totals */}
        <div>
          <h3 className="text-lg font-semibold mb-4">
            {t('analytics.outcomes.totals')}
          </h3>
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {item.name}: {formatters.number(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
