import { useEffect, useState, type ReactNode } from 'react'

interface TextFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  disabled?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  disabled,
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-oxygen-silver-light">
        {label} {required && <span className="text-oxygen-red">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-12 rounded-xl bg-oxygen-black-deep px-4 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}

interface TextAreaFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: TextAreaFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-oxygen-silver-light">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-none rounded-xl bg-oxygen-black-deep px-4 py-3 text-white outline-none ring-1 ring-oxygen-silver/30 focus:ring-oxygen-red"
      />
    </div>
  )
}

interface GenderFieldProps {
  value: 'men' | 'women'
  onChange: (v: 'men' | 'women') => void
}

export function GenderField({ value, onChange }: GenderFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-oxygen-silver-light">الجنس</label>
      <div className="grid grid-cols-2 gap-3">
        <GenderOption
          selected={value === 'men'}
          label="ذكور"
          onClick={() => onChange('men')}
        />
        <GenderOption
          selected={value === 'women'}
          label="إناث"
          onClick={() => onChange('women')}
        />
      </div>
    </div>
  )
}

function GenderOption({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-12 rounded-xl font-bold transition-colors ring-1 ${
        selected
          ? 'bg-oxygen-red/20 text-oxygen-red-light ring-oxygen-red'
          : 'bg-oxygen-black-deep text-oxygen-silver ring-oxygen-silver/30 hover:ring-oxygen-red'
      }`}
    >
      {label}
    </button>
  )
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-sm font-bold text-oxygen-silver">{children}</h4>
  )
}
