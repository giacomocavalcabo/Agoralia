export default function TimeSeries({ data, title, height = 200 }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        <div className="text-gray-500 text-center py-8">No data available</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <div className="h-48 flex items-end justify-between space-x-1">
        {data.map((item, index) => (
          <div key={index} className="flex-1 bg-blue-500 rounded-t" style={{ height: `${(item.value / Math.max(...data.map(d => d.value))) * 100}%` }}>
            <div className="text-xs text-white text-center mt-1">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        {data.map((item, index) => (
          <span key={index}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}
