import { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'

type AlertVariant = 'error' | 'success' | 'info' | 'warning'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; iconColor: string; icon: ReactNode }> = {
  error: {
    bg: 'bg-danger/10',
    border: 'border-danger/25',
    text: 'text-danger',
    iconColor: 'text-danger',
    icon: <AlertCircle size={16} />,
  },
  success: {
    bg: 'bg-success/10',
    border: 'border-success/25',
    text: 'text-success',
    iconColor: 'text-success',
    icon: <CheckCircle2 size={16} />,
  },
  info: {
    bg: 'bg-information/10',
    border: 'border-information/25',
    text: 'text-information',
    iconColor: 'text-information',
    icon: <Info size={16} />,
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/25',
    text: 'text-warning',
    iconColor: 'text-warning',
    icon: <AlertTriangle size={16} />,
  },
}

export function Alert({ variant = 'error', title, children }: AlertProps) {
  const style = variantStyles[variant]

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 ${style.bg} ${style.border} ${style.text}`}>
      <div className={`shrink-0 mt-0.5 ${style.iconColor}`}>{style.icon}</div>
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
