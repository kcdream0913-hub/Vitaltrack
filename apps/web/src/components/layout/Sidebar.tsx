'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Activity, Pill, Calendar, FileText,
  Settings, HelpCircle, TrendingUp, User, ChevronLeft, ChevronRight,
  FolderHeart,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
      { label: 'Analytics',    href: '/analytics',    icon: TrendingUp },
    ],
  },
  {
    label: 'Health',
    items: [
      { label: 'Vitals',        href: '/vitals',       icon: Activity },
      { label: 'Medications',   href: '/medications',  icon: Pill },
      { label: 'Records',       href: '/records',      icon: FolderHeart },
      { label: 'Appointments',  href: '/appointments', icon: Calendar },
      { label: 'Reports',       href: '/reports',      icon: FileText },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Profile',       href: '/profile',      icon: User },
      { label: 'Settings',      href: '/settings',     icon: Settings },
      { label: 'Help',          href: '/help',         icon: HelpCircle },
    ],
  },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-white border-r border-neutral-200 shadow-sm',
      'transition-all duration-slow',
      collapsed ? 'w-16' : 'w-60',
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
        {!collapsed && (
          <span className="text-xl font-bold text-primary-600 tracking-tight">VitalTrack</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 transition-colors duration-fast"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium',
                        'transition-colors duration-fast',
                        active
                          ? 'bg-primary-50 text-primary-600 border-l-[3px] border-primary-600'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800',
                      )}
                    >
                      <Icon className={cn('w-5 h-5 flex-shrink-0',
                        active ? 'text-primary-600' : 'text-neutral-400 group-hover:text-neutral-600')} />
                      {!collapsed && item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-neutral-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary-600">JD</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800 truncate">John Doe</p>
              <p className="text-xs text-neutral-500 truncate">john@example.com</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
