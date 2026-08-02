import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ marginBottom: '24px' }}
    >
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.025em', lineHeight: 1.3 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: '13px', color: '#737373', marginTop: '2px' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
