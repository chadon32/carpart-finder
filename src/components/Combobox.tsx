import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export type ComboboxGroup = {
  label: string
  options: string[]
}

export function Combobox({
  label,
  placeholder,
  options = [],
  groups,
  value,
  onChange,
  disabled,
  allowFreeText,
}: {
  label: string
  placeholder: string
  options?: string[]
  groups?: ComboboxGroup[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  allowFreeText?: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trimmedQuery = query.trim()

  // Support both flat options and grouped options
  const allOptions = groups 
    ? groups.flatMap(g => g.options) 
    : options

  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase()

    if (groups) {
      if (!q) {
        // Return all groups when no search query
        return groups.map(group => ({
          label: group.label,
          options: group.options
        }))
      }
      // Filter within groups when searching
      return groups.map(group => ({
        label: group.label,
        options: group.options.filter(o => o.toLowerCase().includes(q))
      })).filter(g => g.options.length > 0)
    }

    // Flat list behavior (backward compatible)
    if (!q) return options
    return options.filter((o) => o.toLowerCase().includes(q))
  }, [options, groups, trimmedQuery])

  const showFreeText =
    allowFreeText &&
    trimmedQuery.length > 0 &&
    !allOptions.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase())

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
        <ul className="absolute z-30 mt-1.5 max-h-72 w-full animate-fade-in overflow-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5">
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

          {/* Grouped rendering */}
          {groups ? (
            (filtered as any[]).length === 0 && !showFreeText ? (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            ) : (
              (filtered as { label: string; options: string[] }[]).map((group) => (
                <li key={group.label}>
                  <div className={`px-3 py-1.5 text-xs font-bold tracking-wider ${
                    group.label === 'Popular Makes' 
                      ? 'text-brand-700 bg-brand-50/60 rounded-md' 
                      : 'text-slate-500'
                  }`}>
                    {group.label}
                  </div>
                  {group.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => submit(option)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                        option === value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </li>
              ))
            )
          ) : (
            /* Flat list rendering */
            <>
              {filtered.length === 0 && !showFreeText && (
                <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
              )}
              {(filtered as string[]).map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submit(option)}
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      option === value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700'
                    }`}
                  >
                    {option}
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  )
}
