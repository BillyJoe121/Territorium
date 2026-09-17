import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ui_boundary', { name: error.name, componentStack: info.componentStack })
  }

  render() {
    if (this.state.failed) {
      return <main className="loading-page error-page" role="alert"><h1>No fue posible mostrar la plataforma</h1><p>Recarga la página. Si el problema continúa, informa al equipo de soporte con la hora del incidente.</p><button className="button primary" onClick={() => window.location.reload()}>Recargar</button></main>
    }
    return this.props.children
  }
}
