import React from 'react'
import * as Switch from '@radix-ui/react-switch'

interface RadixSwitchProps {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

export function RadixSwitch({
  id,
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
}: RadixSwitchProps) {
  return (
    <div className="radix-switch-container">
      <div className="radix-switch-text">
        {label && (
          <label htmlFor={id} className="radix-switch-label">
            {label}
          </label>
        )}
        {description && <p className="radix-switch-description">{description}</p>}
      </div>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="radix-switch-root"
      >
        <Switch.Thumb className="radix-switch-thumb" />
      </Switch.Root>
    </div>
  )
}
