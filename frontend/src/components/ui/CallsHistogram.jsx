import { useTranslation } from 'react-i18next';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { createNumberFormatter } from '../../lib/format';

export default function CallsHistogram({ 
  buckets = [], 
  label = "Calls", 
  className = "",
  height = 200 
}) {
  const { t, i18n } = useTranslation();
  const formatters = createNumberFormatter(i18n.language, 'EUR');
  
  if (!buckets || buckets.length === 0) {
    return (
      <div className={`flex items-center justify-center h-40 text-muted-foreground ${className}`}>
        {t("common.loading")}
      </div>
    );
  }

  // Transform data for Recharts
  const chartData = buckets.map((bucket, index) => ({
    day: bucket.label || `Day ${index + 1}`,
    calls: bucket.count || 0
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.day}</p>
          <p className="text-sm text-muted-foreground">
            {label}: {formatters.number(data.calls)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="day" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            width={36}
          />
          <Tooltip content={<CustomTooltip label={label} />} />
          <Bar 
            dataKey="calls" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
