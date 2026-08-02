import { Users } from 'lucide-react'
import { TagInput } from './TagInput'

interface CollaboratorsInputProps {
  value: string[]
  onChange: (val: string[]) => void
  max?: number
}

export function CollaboratorsInput({ value, onChange, max = 3 }: CollaboratorsInputProps) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
        <Users size={13} /> Collaborators
      </label>
      <TagInput
        value={value}
        onChange={onChange}
        prefix="@"
        placeholder="Type a username, press Enter…"
        max={max}
      />
      <p className="text-[11px] text-text-tertiary mt-1.5">
        {value.length} of {max} used — invited accounts appear as co-authors once they accept.
      </p>
    </div>
  )
}
