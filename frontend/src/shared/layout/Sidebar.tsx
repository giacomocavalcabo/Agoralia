import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/utils/cn'

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/setup', label: 'Setup' },
  { path: '/campaigns', label: 'Campagne' },
  { path: '/agents', label: 'Agents' },
  { path: '/numbers', label: 'Numeri' },
  { path: '/knowledge', label: 'Knowledge Bases' },
  { path: '/leads', label: 'Leads' },
  { path: '/calls', label: 'Chiamate' },
  { path: '/settings', label: 'Settings' },
  { path: '/compliance', label: 'Compliance' },
  { path: '/billing', label: 'Billing' },
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Agoralia</h1>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

