import * as React from 'react'
import { cn } from '@/utils/format'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-subtle focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50', className)} {...props} />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('min-h-[80px] w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-subtle focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-muted', className)} {...props} />
}

export function Field({ label, error, hint, children, required }: { label: string; error?: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  const autoId = React.useId()
  const child = React.isValidElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(children) ? children : null
  const id = child?.props.id ?? autoId
  const noteId = `${id}-note`
  return (
    <div>
      <Label htmlFor={child ? id : undefined}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </Label>
      {child ? React.cloneElement(child, { id, 'aria-describedby': error || hint ? noteId : child.props['aria-describedby'], 'aria-invalid': error ? true : child.props['aria-invalid'] }) : children}
      {error ? <p id={noteId} className="mt-1 text-xs text-red-600" role="alert">{error}</p> : hint ? <p id={noteId} className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  )
}

/** Native select styled to match — accessible and keyboard friendly. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn('h-9 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-fg focus:border-violet-500/60 focus:outline-none focus:ring-2 focus:ring-violet-500/20', className)} {...props}>
    {children}
  </select>
))
NativeSelect.displayName = 'NativeSelect'
