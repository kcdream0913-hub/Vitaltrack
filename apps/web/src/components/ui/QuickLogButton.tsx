'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Heart, Footprints, Droplets, Moon, Scale, Pill, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOG_OPTIONS = [
  { label: 'Heart Rate',      icon: Heart,      type: 'heart_rate'      },
  { label: 'Blood Pressure',  icon: Scale,      type: 'blood_pressure'  },
  { label: 'Blood Glucose',   icon: Droplets,   type: 'glucose'         },
  { label: 'Steps',           icon: Footprints, type: 'steps'           },
  { label: 'Sleep',           icon: Moon,       type: 'sleep'           },
  { label: 'Medication',      icon: Pill,       type: 'medication'      },
  { label: 'More…',           icon: MoreHorizontal, type: 'more'        },
]

export function QuickLogButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2">
      {/* Dropdown menu */}
      {open && (
        <div className={cn(
          'bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden',
          'w-60 animate-in slide-in-from-bottom-2 duration-normal',
        )}>
          {LOG_OPTIONS.map(option => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-neutral-700
                  hover:bg-primary-50 hover:text-primary-700 transition-colors duration-fast text-left"
              >
                <Icon className="w-5 h-5 text-neutral-400" />
                {option.label}
              </button>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Log a reading"
        aria-expanded={open}
        className={cn(
          'w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg',
          'flex items-center justify-center',
          'hover:bg-primary-700 hover:scale-105 active:scale-95',
          'transition-all duration-fast focus:outline-none focus:ring-4 focus:ring-primary-600/30',
          open && 'rotate-45',
        )}
      >
        <Plus className="w-7 h-7" />
      </button>
    </div>
  )
}
