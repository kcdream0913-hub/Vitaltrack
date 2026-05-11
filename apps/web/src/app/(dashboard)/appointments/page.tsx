import { Calendar } from 'lucide-react'

export default function AppointmentsPage() {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-12 max-w-md w-full text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: '#1E6FD91a' }}
        >
          <Calendar className="w-8 h-8" style={{ color: '#1E6FD9' }} />
        </div>

        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Appointments</h1>

        <p className="text-neutral-500 text-sm leading-relaxed">
          Calendar view and appointment tracking coming soon.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1E6FD9] animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-[#1E6FD9] animate-pulse [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-[#1E6FD9] animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
