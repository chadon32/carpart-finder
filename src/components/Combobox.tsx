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

export function Combobox({
  id,
  label,
  ariaLabel,
  placeholder,
  options = [],
  groups,
  value,
  onChange,
  onInputChange,
  disabled,
  allowFreeText,
  enterKeyHint,
  maxLength,
  onInvalidFreeTextSubmit,
}: {
  id?: string
  label: string
  ariaLabel?: string
  placeholder: string
  options?: string[]
  groups?: ComboboxGroup[]
  value: string
  onChange: (value: string) => void
  onInputChange?: (value: string) => void
  disabled?: boolean
  allowFreeText?: boolean
  enterKeyHint?: 'search' | 'go' | 'done' | 'next'
  maxLength?: number
  onInvalidFreeTextSubmit?: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [emptySubmit, setEmptySubmit] = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestInputValue = useRef('')
  const listId = useId()
  const inputId = id ?? `${listId}-input`
  const accessibleName = ariaLabel || label || placeholder

  useEffect(() => () => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
  }, [])

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
  }, [options, groups, trimmedQuery, allowFreeText, value])

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
    setEmptySubmit(false)
    setOpen(false)
    setQuery('')
    latestInputValue.current = ''
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
      setActiveIndex((prev) => prev < 0
        ? (delta > 0 ? 0 : items.length - 1)
        : (prev + delta + items.length) % items.length)
      return
    }
    if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault()
        submit(items[activeIndex].value)
      } else if (allowFreeText) {
        e.preventDefault()
        // Track input events outside React's render cycle so a rapid clear +
        // Enter cannot submit the value from the previous render.
        const currentValue = latestInputValue.current.trim()
        if (!currentValue) {
          setEmptySubmit(true)
          onInvalidFreeTextSubmit?.()
          return
        }
        submit(currentValue)
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
      {label && <label htmlFor={inputId} className="field-label">{label}</label>}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-label={accessibleName}
          aria-expanded={open && !disabled}
          aria-controls={open && !disabled ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && !disabled && items[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined}
          disabled={disabled}
          placeholder={placeholder}
          enterKeyHint={enterKeyHint}
          maxLength={maxLength}
          value={open ? query : value}
          onFocus={(e) => {
            if (blurTimeout.current) clearTimeout(blurTimeout.current)
            setOpen(true)
            setQuery(value)
            latestInputValue.current = value
            e.currentTarget.select()
          }}
          onChange={(e) => {
            latestInputValue.current = e.target.value
            setEmptySubmit(false)
            setQuery(e.target.value)
            onInputChange?.(e.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          aria-invalid={emptySubmit || undefined}
          aria-describedby={emptySubmit ? `${listId}-empty-submit` : undefined}
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
          aria-label={accessibleName}
          className="absolute z-30 mt-1.5 max-h-60 w-full animate-fade-in overflow-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 sm:max-h-72"
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
                className={`cursor-pointer touch-manipulation rounded-lg px-3 py-3 text-sm transition sm:py-2 ${
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
      {allowFreeText && emptySubmit && (
        <p id={`${listId}-empty-submit`} role="alert" className="mt-1.5 text-xs text-rose-600">
          Enter a part name or choose a suggested part.
        </p>
      )}
    </div>
  )
}
