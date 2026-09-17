import React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical } from 'lucide-react'

export interface DropdownActionItem {
  id: string
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'danger'
}

interface ActionDropdownProps {
  items: DropdownActionItem[]
  triggerLabel?: string
  ariaLabel?: string
}

export function ActionDropdown({ items, triggerLabel, ariaLabel = 'Opciones' }: ActionDropdownProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="radix-dropdown-trigger"
          aria-label={ariaLabel}
        >
          {triggerLabel ? <span>{triggerLabel}</span> : <MoreVertical size={16} />}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="radix-dropdown-content"
          sideOffset={5}
          align="end"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.id}
              className={`radix-dropdown-item ${item.variant === 'danger' ? 'danger' : ''}`}
              disabled={item.disabled}
              onSelect={() => item.onClick()}
            >
              {item.icon && <span className="radix-item-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
