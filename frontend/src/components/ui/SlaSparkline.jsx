export default function SlaSparkline({ data, title, target = 95 }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <div className="text-gray-500 text-center py-8">No data available</div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <div className="flex items-end justify-between space-x-1 h-20">
        {data.map((item, index) => {
          const height = range > 0 ? ((item.value - minValue) / range) * 100 : 50;
          const isAboveTarget = item.value >= target;
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className={`w-full rounded-t ${isAboveTarget ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ height: `${height}%` }}
              />
              <div className="text-xs text-gray-500 mt-1">{item.value}%</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-sm text-gray-500">
        Target: {target}% • Current: {data[data.length - 1]?.value || 0}%
      </div>
    </div>
  );
}
