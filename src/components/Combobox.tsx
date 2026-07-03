import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export function Combobox({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  allowFreeText,
}: {
  label: string
  placeholder: string
  options: string[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  allowFreeText?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trimmedQuery = query.trim()

  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase()
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, trimmedQuery])

  const showFreeText =
    allowFreeText &&
    trimmedQuery.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase())

  const submit = (val: string) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative">
      {label && <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={() => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current)
            setOpen(true)
            setQuery('')
          }}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && allowFreeText && trimmedQuery) {
              e.preventDefault()
              submit(trimmedQuery)
            }
          }}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setOpen(false), 150)
          }}
          className="field pr-9"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          {allowFreeText ? <Search size={16} /> : <ChevronDown size={16} className={open ? 'rotate-180 transition' : 'transition'} />}
        </span>
      </div>
      {open && !disabled && (
        <ul className="absolute z-30 mt-1.5 max-h-60 w-full animate-fade-in overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10">
          {showFreeText && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(trimmedQuery)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                <Search size={15} /> Search “{trimmedQuery}”
              </button>
            </li>
          )}
          {filtered.length === 0 && !showFreeText && (
            <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
          )}
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(option)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
                  option === value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
