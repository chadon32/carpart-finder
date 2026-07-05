import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

export type ComboboxGroup = {
  label: string
  options: string[]
}

// One flattened render model covers all three modes (flat list, grouped list,
// free-text search): headers are decorative, items are selectable and carry a
// sequential index that keyboard navigation moves through.
type Entry =
  | { kind: 'header'; label: string }
  | { kind: 'item'; index: number; value: string; isFree: boolean }

function translateObd2(query: string): string | null {
  const code = query.trim().toUpperCase()
  if (!/^[P]\d{4}$/.test(code)) return null

  if (/^P03\d{2}$/.test(code)) {
    return 'Spark Plugs & Ignition Coils'
  }
  if (code === 'P0171' || code === 'P0174') {
    return 'Oxygen Sensor & Mass Airflow Sensor'
  }
  if (code === 'P0420' || code === 'P0430') {
    return 'Catalytic Converter & O2 Sensors'
  }
  if (code === 'P0440' || code === 'P0442' || code === 'P0455' || code === 'P0456') {
    return 'Gas Cap & Evap Purge Valve'
  }
  if (/^P011[5-9]$/.test(code)) {
    return 'Coolant Temperature Sensor'
  }
  if (code === 'P0100' || code === 'P0101' || code === 'P0102') {
    return 'Mass Airflow Sensor (MAF)'
  }
  return null
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
  const [activeIndex, setActiveIndex] = useState(-1)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listId = useId()

  const trimmedQuery = query.trim()

  const { entries, items } = useMemo(() => {
    const q = trimmedQuery.toLowerCase()
    const entries: Entry[] = []
    const items: Extract<Entry, { kind: 'item' }>[] = []

    const pushItem = (val: string, isFree = false) => {
      const item = { kind: 'item' as const, index: items.length, value: val, isFree }
      items.push(item)
      entries.push(item)
    }

    const obdMatch = translateObd2(trimmedQuery)
    if (obdMatch) {
      entries.push({ kind: 'header', label: `Diagnostic Code ${trimmedQuery.toUpperCase()}` })
      pushItem(obdMatch)
    }

    const allOptions = groups ? groups.flatMap((g) => g.options) : options
    const showFreeText =
      Boolean(allowFreeText) &&
      trimmedQuery.length > 0 &&
      !allOptions.some((o) => o.toLowerCase() === q)

    if (showFreeText) pushItem(trimmedQuery, true)

    const isExactMatchSelected = value && trimmedQuery.toLowerCase() === value.toLowerCase()
    const filterQuery = isExactMatchSelected ? '' : q

    if (groups) {
      for (const group of groups) {
        const matches = filterQuery ? group.options.filter((o) => o.toLowerCase().includes(filterQuery)) : group.options
        if (matches.length === 0) continue
        entries.push({ kind: 'header', label: group.label })
        matches.forEach((m) => pushItem(m))
      }
    } else {
      const matches = filterQuery ? options.filter((o) => o.toLowerCase().includes(filterQuery)) : options
      matches.forEach((m) => pushItem(m))
    }

    return { entries, items }
  }, [options, groups, trimmedQuery, allowFreeText])

  // Reset keyboard highlight whenever the candidate list changes.
  useEffect(() => {
    setActiveIndex(-1)
  }, [trimmedQuery, open])

  // Keep the highlighted option visible while arrowing through a long list.
  useEffect(() => {
    if (activeIndex >= 0) {
      document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, listId])

  const submit = (val: string) => {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (items.length === 0) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((prev) => (prev + delta + items.length) % items.length)
      return
    }
    if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault()
        submit(items[activeIndex].value)
      } else if (allowFreeText && trimmedQuery) {
        e.preventDefault()
        submit(trimmedQuery)
      }
      return
    }
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      return
    }
    if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      {label && <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>}
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : value}
          onFocus={(e) => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current)
            setOpen(true)
            setQuery(value)
            e.currentTarget.select()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setOpen(false), 150)
          }}
          className="field pr-9"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          {allowFreeText ? (
            <Search size={16} />
          ) : (
            <ChevronDown size={16} className={open ? 'rotate-180 transition' : 'transition'} />
          )}
        </span>
      </div>
      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-72 w-full animate-fade-in overflow-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
        >
          {items.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matches</li>}
          {entries.map((entry) =>
            entry.kind === 'header' ? (
              <li key={`h-${entry.label}`} aria-hidden className="px-3 py-1.5 text-xs font-bold tracking-wider text-slate-500">
                {entry.label}
              </li>
            ) : (
              <li
                key={entry.isFree ? '__free__' : `${entry.value}-${entry.index}`}
                id={`${listId}-opt-${entry.index}`}
                role="option"
                aria-selected={entry.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(entry.value)}
                onMouseMove={() => setActiveIndex(entry.index)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-sm transition ${
                  entry.isFree
                    ? `flex items-center gap-2 font-semibold text-brand-700 ${
                        activeIndex === entry.index ? 'bg-brand-50' : 'hover:bg-brand-50'
                      }`
                    : activeIndex === entry.index
                      ? 'bg-slate-100 text-slate-900'
                      : entry.value === value
                        ? 'bg-brand-50 font-semibold text-brand-700'
                        : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {entry.isFree ? (
                  <>
                    <Search size={15} /> Search “{entry.value}”
                  </>
                ) : (
                  entry.value
                )}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}
