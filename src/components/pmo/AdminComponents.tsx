import type { ReactNode } from 'react'

export function GuideSidebar({ title = 'Configuración', items, activeId, onSelect }: { title?: string; items: Array<{ id: string; label: string }>; activeId: string; onSelect: (id: string) => void }) {
  return <nav className="guide-sidebar" aria-label={title}><strong>{title}</strong>{items.map((item) => <button type="button" className={item.id === activeId ? 'active' : ''} onClick={() => onSelect(item.id)} key={item.id}>{item.label}</button>)}</nav>
}

export function AdminPanel({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return <section className="admin-panel"><header><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</header>{children}</section>
}

export const AdminPanelView = AdminPanel

export function ModelsSection({ children }: { children: ReactNode }) { return <section className="admin-section models-section"><h3>Modelos y extractores</h3>{children}</section> }
export function QuestionsSection({ children }: { children: ReactNode }) { return <section className="admin-section questions-section"><h3>Prompts y validaciones</h3>{children}</section> }
export function UsersSection({ children }: { children: ReactNode }) { return <section className="admin-section users-section"><h3>Usuarios y permisos</h3>{children}</section> }
