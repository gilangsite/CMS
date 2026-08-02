export type PreviewAspectRatio = '1:1' | '4:5' | '9:16'

const RATIOS: { value: PreviewAspectRatio; label: string; desc: string }[] = [
  { value: '1:1', label: '1:1', desc: 'Square' },
  { value: '4:5', label: '4:5', desc: 'Portrait' },
  { value: '9:16', label: '9:16', desc: 'Reels / Story' },
]

interface AspectRatioSelectorProps {
  value: PreviewAspectRatio
  onChange: (val: PreviewAspectRatio) => void
}

export function AspectRatioSelector({ value, onChange }: AspectRatioSelectorProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
        Layout Preview Ratio
      </label>
      <div className="flex gap-2">
        {RATIOS.map((ratio) => {
          const selected = value === ratio.value
          return (
            <button
              key={ratio.value}
              type="button"
              onClick={() => onChange(ratio.value)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg border text-center transition-all ${
                selected
                  ? 'border-accent-primary bg-[rgba(145,168,255,0.1)] text-text-primary'
                  : 'border-border-default bg-[rgba(0,0,0,0.2)] text-text-secondary hover:border-border-strong'
              }`}
            >
              <span className="text-[12.5px] font-semibold">{ratio.label}</span>
              <span className="text-[10px] text-text-tertiary">{ratio.desc}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
