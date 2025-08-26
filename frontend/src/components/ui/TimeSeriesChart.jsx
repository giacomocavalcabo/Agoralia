import { useTranslation } from 'react-i18next';
import { 
  LineChart, 
  Line, 
  Area, 
  AreaChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { createDateFormatter } from '../../lib/format';

const COLORS = {
  reached: '#3b82f6',      // Blue
  connected: '#10b981',    // Green  
  qualified: '#f59e0b',    // Amber
  booked: '#ef4444'        // Red
};

export default function TimeSeriesChart({ 
  data, 
  className = "",
  showArea = true,
  showMovingAverage = false,
  height = 200 
}) {
  const { t, i18n } = useTranslation();
  const dateFormatters = createDateFormatter(i18n.language);
  
  if (!data || !data.series || data.series.length === 0) {
    return (
      <div className={`flex items-center justify-center h-40 text-muted-foreground ${className}`}>
        {t("common.loading")}
      </div>
    );
  }

  // Transform data for Recharts
  const chartData = data.series.map(item => ({
    ...item,
    date: dateFormatters.date(item.date),
    // Add moving average if requested
    ...(showMovingAverage && {
      reached_ma: item.reached,
      connected_ma: item.connected,
      qualified_ma: item.qualified,
      booked_ma: item.booked
    })
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-foreground">
                  {entry.name}: {formatters.number(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return dateFormatters.date(date);
            }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {showArea ? (
            <>
              <Area 
                type="monotone" 
                dataKey="reached" 
                stackId="1" 
                stroke={COLORS.reached} 
                fill={COLORS.reached} 
                fillOpacity={0.3}
                name={t("pages.analytics.kpi.reached")}
              />
              <Area 
                type="monotone" 
                dataKey="connected" 
                stackId="2" 
                stroke={COLORS.connected} 
                fill={COLORS.connected} 
                fillOpacity={0.3}
                name={t("pages.analytics.kpi.connected")}
              />
              <Area 
                type="monotone" 
                dataKey="qualified" 
                stackId="3" 
                stroke={COLORS.qualified} 
                fill={COLORS.qualified} 
                fillOpacity={0.3}
                name={t("pages.analytics.kpi.qualified")}
              />
              <Area 
                type="monotone" 
                dataKey="booked" 
                stackId="4" 
                stroke={COLORS.booked} 
                fill={COLORS.booked} 
                fillOpacity={0.3}
                name={t("pages.analytics.kpi.booked")}
              />
            </>
          ) : (
            <>
              <Line 
                type="monotone" 
                dataKey="reached" 
                stroke={COLORS.reached} 
                strokeWidth={2}
                dot={{ fill: COLORS.reached, strokeWidth: 2, r: 3 }}
                name={t("pages.analytics.kpi.reached")}
              />
              <Line 
                type="monotone" 
                dataKey="connected" 
                stroke={COLORS.connected} 
                strokeWidth={2}
                dot={{ fill: COLORS.connected, strokeWidth: 2, r: 3 }}
                name={t("pages.analytics.kpi.connected")}
              />
              <Line 
                type="monotone" 
                dataKey="qualified" 
                stroke={COLORS.qualified} 
                strokeWidth={2}
                dot={{ fill: COLORS.qualified, strokeWidth: 2, r: 3 }}
                name={t("pages.analytics.kpi.qualified")}
              />
              <Line 
                type="monotone" 
                dataKey="booked" 
                stroke={COLORS.booked} 
                strokeWidth={2}
                dot={{ fill: COLORS.booked, strokeWidth: 2, r: 3 }}
                name={t("pages.analytics.kpi.booked")}
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
