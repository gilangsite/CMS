import { Hash, AtSign, Smile } from 'lucide-react'
import { PostDestination } from './ContentComposer'
import { TagInput } from './TagInput'

interface CaptionEditorProps {
  caption: string
  hashtags: string[]
  mentions: string[]
  destination: PostDestination
  onCaptionChange: (val: string) => void
  onHashtagsChange: (val: string[]) => void
  onMentionsChange: (val: string[]) => void
}

export function CaptionEditor({
  caption,
  hashtags,
  mentions,
  destination,
  onCaptionChange,
  onHashtagsChange,
  onMentionsChange,
}: CaptionEditorProps) {
  const maxCaptionLength = destination.startsWith('instagram') ? 2200 : 4000
  const maxHashtags = destination.startsWith('instagram') ? 30 : null

  return (
    <div className="space-y-4">
      {/* Textarea */}
      <div className="relative">
        <textarea
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Write your engaging caption here..."
          className="textarea-field w-full min-h-[160px] pb-10 resize-y"
          maxLength={maxCaptionLength}
        />
        
        {/* Formatting / Limits Toolbar inside textarea */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-text-tertiary">
          <div className="flex items-center gap-1">
            <button className="action-btn w-8 h-8 rounded-lg" title="Add Emoji" type="button"><Smile size={15} /></button>
          </div>
          <div className="text-[11px] font-medium font-mono">
            {caption.length} <span className="opacity-50">/ {maxCaptionLength}</span>
          </div>
        </div>
      </div>

      {/* Tags & Mentions row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Hashtags */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
            <Hash size={13} /> Hashtags
          </label>
          <TagInput
            value={hashtags}
            onChange={onHashtagsChange}
            prefix="#"
            placeholder="Type a keyword, press Enter…"
            max={maxHashtags}
          />
          {maxHashtags && (
            <p className="text-[11px] text-text-tertiary mt-1.5">
              {hashtags.length} of {maxHashtags} used
            </p>
          )}
        </div>

        {/* Mentions */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
            <AtSign size={13} /> Mentions
          </label>
          <TagInput
            value={mentions}
            onChange={onMentionsChange}
            prefix="@"
            placeholder="Type a username, press Enter…"
            max={20}
          />
        </div>
      </div>
    </div>
  )
}
