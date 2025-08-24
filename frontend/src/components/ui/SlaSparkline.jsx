import React, { useEffect, useRef } from 'react'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Tooltip } from 'chart.js'
Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip)

export default function SlaSparkline({ points = [], thresholdMs = 5000 }) {
  const ref = useRef(null)
  
  useEffect(() => {
    if (!ref.current) return
    const ctx = ref.current.getContext('2d')
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map((_,i)=>i+1),
        datasets: [{
          data: points,
          borderColor: 'rgba(46,107,255,0.9)',
          backgroundColor: 'rgba(46,107,255,0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 0
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
          x: { display: false }, 
          y: { display: false } 
        }
      }
    })
    
    return () => chart.destroy()
  }, [points])
  
  return <div className="h-20"><canvas ref={ref} /></div>
}
