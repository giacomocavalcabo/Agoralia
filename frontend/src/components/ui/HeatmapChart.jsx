import { useTranslation } from 'react-i18next';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const getHeatmapColor = (calls, maxCalls) => {
  if (calls === 0) return 'bg-gray-50';
  const intensity = Math.min(calls / maxCalls, 1);
  if (intensity < 0.3) return 'bg-blue-100';
  if (intensity < 0.6) return 'bg-blue-200';
  if (intensity < 0.8) return 'bg-blue-300';
  return 'bg-blue-500';
};

export default function HeatmapChart({ data, className = "" }) {
  const { t } = useTranslation();
  
  if (!data || !data.matrix || data.matrix.length === 0) {
    return (
      <div className={`flex items-center justify-center h-40 text-muted-foreground ${className}`}>
        {t("common.loading")}
      </div>
    );
  }

  // Find max calls for color scaling
  const maxCalls = Math.max(...data.matrix.map(item => item.calls));
  
  // Group data by day of week
  const groupedData = {};
  DAYS.forEach((_, index) => {
    groupedData[index] = {};
    HOURS.forEach(hour => {
      groupedData[index][hour] = { calls: 0, connected_rate: 0 };
    });
  });

  // Populate grouped data
  data.matrix.forEach(item => {
    if (groupedData[item.dow] && groupedData[item.dow][item.hour]) {
      groupedData[item.dow][item.hour] = {
        calls: item.calls,
        connected_rate: item.connected_rate
      };
    }
  });

  const CustomTooltip = ({ day, hour, calls, connected_rate }) => {
    if (calls === 0) return null;
    
    return (
      <div className="absolute z-10 bg-popover border rounded-lg p-3 shadow-lg text-sm">
        <div className="font-medium text-foreground">
          {DAYS[day]} {hour}:00
        </div>
        <div className="text-muted-foreground">
          {calls} calls
        </div>
        <div className="text-muted-foreground">
          {(connected_rate * 100).toFixed(1)}% connected
        </div>
      </div>
    );
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <h4 className="text-sm font-medium text-foreground mb-2">
          {t("analytics.charts.heatmap")}
        </h4>
        <p className="text-xs text-muted-foreground">
          Call volume by day and hour (darker = more calls)
        </p>
      </div>

      <div className="grid grid-cols-25 gap-1">
        {/* Hour labels */}
        <div className="h-6" /> {/* Empty corner */}
        {HOURS.map(hour => (
          <div key={hour} className="h-6 flex items-center justify-center text-xs text-muted-foreground">
            {hour}:00
          </div>
        ))}
        
        {/* Day rows */}
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="contents">
            {/* Day label */}
            <div className="h-6 flex items-center justify-center text-xs font-medium text-foreground">
              {day}
            </div>
            
            {/* Hour cells */}
            {HOURS.map(hour => {
              const cellData = groupedData[dayIndex][hour];
              const { calls, connected_rate } = cellData;
              
              return (
                <div
                  key={`${dayIndex}-${hour}`}
                  className={`h-6 rounded-sm border border-gray-100 relative group cursor-pointer transition-colors ${
                    getHeatmapColor(calls, maxCalls)
                  }`}
                  title={`${day} ${hour}:00 - ${calls} calls, ${(connected_rate * 100).toFixed(1)}% connected`}
                >
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <CustomTooltip 
                      day={dayIndex} 
                      hour={hour} 
                      calls={calls} 
                      connected_rate={connected_rate} 
                    />
                  </div>
                  
                  {/* Call count (only show if > 0) */}
                  {calls > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                      {calls}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded-sm" />
          <span>No calls</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 rounded-sm" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-300 rounded-sm" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded-sm" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
