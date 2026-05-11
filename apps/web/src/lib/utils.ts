import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMetricValue(value: number, type: string): string {
  switch (type) {
    case 'heart_rate':      return `${Math.round(value)}`
    case 'blood_pressure':  return `${Math.round(value)}`
    case 'glucose':         return value.toFixed(1)
    case 'weight':          return value.toFixed(1)
    case 'spo2':            return `${Math.round(value)}`
    case 'temperature':     return value.toFixed(1)
    default:                return `${value}`
  }
}

export function getMetricUnit(type: string): string {
  const units: Record<string, string> = {
    heart_rate:     'BPM',
    blood_pressure: 'mmHg',
    glucose:        'mg/dL',
    weight:         'kg',
    spo2:           '%',
    temperature:    '°C',
    steps:          'steps',
    respiratory_rate: '/min',
  }
  return units[type] ?? ''
}

export function getMetricStatus(value: number, type: string): 'normal' | 'high' | 'low' | 'critical' {
  const ranges: Record<string, { low: number; high: number; critical_high?: number; critical_low?: number }> = {
    heart_rate:     { low: 60,  high: 100, critical_high: 150, critical_low: 40 },
    glucose:        { low: 70,  high: 180, critical_high: 300, critical_low: 55 },
    spo2:           { low: 95,  high: 100, critical_low: 90 },
    temperature:    { low: 36.1, high: 37.2, critical_high: 39.4, critical_low: 35 },
  }
  const range = ranges[type]
  if (!range) return 'normal'
  if (range.critical_high && value >= range.critical_high) return 'critical'
  if (range.critical_low  && value <= range.critical_low)  return 'critical'
  if (value > range.high) return 'high'
  if (value < range.low)  return 'low'
  return 'normal'
}

export function getMetricColor(type: string): string {
  const colors: Record<string, string> = {
    heart_rate:     'text-red-500',
    steps:          'text-primary-600',
    glucose:        'text-orange-500',
    sleep:          'text-purple-500',
    weight:         'text-secondary-500',
    blood_pressure: 'text-red-600',
    spo2:           'text-sky-500',
    temperature:    'text-amber-500',
  }
  return colors[type] ?? 'text-primary-600'
}

export function greetingByHour(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
