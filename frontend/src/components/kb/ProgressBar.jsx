import { ProgressBar } from '../ui/ProgressBar';

export function KBProgressBar({ 
  value, 
  label, 
  showPercentage = true, 
  size = 'md',
  color = 'blue',
  className = '' 
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-gray-500">{value}%</span>
          )}
        </div>
      )}
      <ProgressBar 
        value={value} 
        size={size}
        color={color}
        showLabel={false}
      />
    </div>
  );
}
