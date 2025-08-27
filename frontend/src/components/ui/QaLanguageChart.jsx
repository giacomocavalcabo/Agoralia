import { useTranslation } from 'react-i18next';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { createNumberFormatter } from '../../lib/format';

export default function QaLanguageChart({ 
  data = {}, 
  className = "",
  height = 300 
}) {
  const { t, i18n } = useTranslation('pages');
  const formatters = createNumberFormatter(i18n.language, 'EUR');
  
  if (!data || !data.distributions) {
    return (
      <div className={`flex items-center justify-center h-40 text-muted-foreground ${className}`}>
        {t("common.no_data")}
      </div>
    );
  }

  // Transform data for radar chart
  const radarData = [
    {
              metric: t('analytics.qa.talk_ratio'),
      value: data.distributions?.talk_ratio?.p50 || 0,
      target: 0.6,
      fullMark: 1.0
    },
    {
              metric: t('analytics.qa.sentiment_agent'),
      value: (data.distributions?.sentiment_agent?.avg || 0) + 1, // Convert -1..1 to 0..2
      target: 1.0,
      fullMark: 2.0
    },
    {
              metric: t('analytics.qa.interruptions'),
      value: Math.max(0, 3 - (data.distributions?.interruptions?.avg || 0)), // Invert: lower is better
      target: 2.0,
      fullMark: 3.0
    }
  ];

  // Transform data for bar chart
  const barData = data.top_objections?.map((obj, index) => ({
            objection: t(`analytics.qa.objections.${obj.label}`, { defaultValue: obj.label }),
    count: obj.count,
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]
  })) || [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.metric || data.objection}</p>
          <p className="text-sm text-muted-foreground">
            {t('common.value')}: {formatters.number(data.value || data.count)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart - Quality Metrics */}
        <div>
          <h3 className="text-lg font-semibold mb-4">
            {t('analytics.qa.quality_metrics')}
          </h3>
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} />
              <Radar
                name={t('analytics.qa.current')}
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
              <Radar
                name={t('analytics.qa.target')}
                dataKey="target"
                stroke="#10b981"
                fill="transparent"
                strokeDasharray="5 5"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Top Objections */}
        <div>
          <h3 className="text-lg font-semibold mb-4">
            {t('analytics.qa.top_objections')}
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={barData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="objection" 
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
                    <Bar key={`bar-${index}`} dataKey="count" fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('analytics.qa.no_objections')}
            </div>
          )}
        </div>
      </div>

      {/* Additional Metrics */}
      {data.distributions && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-semibold text-primary">
              {formatters.percent((data.distributions?.talk_ratio?.p50 || 0))}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('analytics.qa.avg_talk_ratio')}
            </div>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-semibold text-primary">
              {formatters.number(data.distributions?.dead_air_sec?.p50 || 0)}s
            </div>
            <div className="text-sm text-muted-foreground">
              {t('analytics.qa.avg_dead_air')}
            </div>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-semibold text-primary">
              {formatters.number(data.distributions?.interruptions?.avg || 0)}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('analytics.qa.avg_interruptions')}
            </div>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-semibold text-primary">
              {formatters.percent((data.distributions?.sentiment_agent?.avg || 0) + 1)}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('analytics.qa.avg_sentiment')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
