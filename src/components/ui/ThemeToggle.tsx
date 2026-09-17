import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export type AppTheme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'territorium_ui_theme'

/**
 * US-225: Gestor de temas Claro / Oscuro sin parpadeo (FOUC).
 * Persiste en localStorage y conmuta clases en <html> / <body>.
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') return saved
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    }
    return 'dark'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('theme-light')
      root.classList.remove('theme-dark')
    } else {
      root.classList.add('theme-dark')
      root.classList.remove('theme-light')
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
      title={`Tema actual: ${theme === 'dark' ? 'Oscuro' : 'Claro'}. Clic para alternar.`}
      className={`relative inline-flex items-center justify-center p-2 rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:text-amber-400 hover:border-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${className}`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-400 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  )
}
