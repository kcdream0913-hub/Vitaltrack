'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'
import { format } from 'date-fns'

interface DataPoint {
  date: string
  value: number
  secondaryValue?: number
}

interface TrendChartProps {
  data: DataPoint[]
  metricType: string
  color?: string
  unit?: string
  normalMin?: number
  normalMax?: number
  height?: number
}

const METRIC_COLORS: Record<string, string> = {
  heart_rate:     '#EF4444',
  blood_pressure: '#DC2626',
  glucose:        '#F97316',
  sleep:          '#8B5CF6',
  weight:         '#16A085',
  spo2:           '#0EA5E9',
  temperature:    '#F59E0B',
  steps:          '#1E6FD9',
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-lg shadow-lg border border-neutral-200 px-3 py-2 text-sm">
      <p className="text-neutral-500 text-xs mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.value} {unit}
        </p>
      ))}
    </div>
  )
}

export function TrendChart({
  data, metricType, color, unit = '', normalMin, normalMax, height = 260,
}: TrendChartProps) {
  const lineColor = color ?? METRIC_COLORS[metricType] ?? '#1E6FD9'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${metricType}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={lineColor} stopOpacity={0.12} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} />

        {normalMin !== undefined && (
          <ReferenceLine y={normalMin} stroke="#16A085" strokeDasharray="4 2" strokeOpacity={0.5} />
        )}
        {normalMax !== undefined && (
          <ReferenceLine y={normalMax} stroke="#F59E0B" strokeDasharray="4 2" strokeOpacity={0.5} />
        )}

        <Area
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          fill={`url(#fill-${metricType})`}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
        {data[0]?.secondaryValue !== undefined && (
          <Line
            type="monotone"
            dataKey="secondaryValue"
            stroke={lineColor}
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
