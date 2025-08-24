import { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js'
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

export default function CallsHistogram({ buckets = [], label }) {
  const ref = useRef(null)
  
  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext('2d')
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [{
          label,
          data: buckets.map(b => b.count ?? 0),
          backgroundColor: 'rgba(46,107,255,0.28)',
          hoverBackgroundColor: 'rgba(46,107,255,0.45)',
          borderWidth: 0,
          borderRadius: 6,
          barThickness: 18
        }]
      },
      options: {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false }, 
          tooltip: { intersect: false, mode: 'index' } 
        },
        scales: {
          x: { grid: { display: false } },
          y: { 
            beginAtZero: true, 
            ticks: { precision: 0 }, 
            grid: { color: 'rgba(148,163,184,0.2)' } 
          }
        }
      }
    })
    
    return () => chart.destroy()
  }, [buckets, label])

  if (!buckets?.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No call data available
      </div>
    )
  }

  return <div className="h-64"><canvas ref={ref} /></div>
}
