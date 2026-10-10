/**
 * Geometría de una ventana flotante que se mueve desde su barra superior y se redimensiona
 * desde bordes y esquinas, sin salirse de la pantalla.
 */

export interface FloatingRect {
  x: number
  y: number
  width: number
  height: number
}

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const MIN_FLOATING_SIZE = { width: 420, height: 320 }

/** Parte de la barra superior que debe quedar visible para poder volver a moverla. */
const VISIBLE_GRIP = 120
const HEADER_HEIGHT = 48

/** Nuevo rectángulo al arrastrar un borde o esquina `dx`/`dy` píxeles. El borde opuesto queda fijo. */
export function resizeRect(start: FloatingRect, edge: ResizeEdge, dx: number, dy: number, min = MIN_FLOATING_SIZE): FloatingRect {
  let { x, y, width, height } = start
  if (edge.includes('e')) width = Math.max(min.width, start.width + dx)
  if (edge.includes('w')) {
    width = Math.max(min.width, start.width - dx)
    x = start.x + start.width - width
  }
  if (edge.includes('s')) height = Math.max(min.height, start.height + dy)
  if (edge.includes('n')) {
    height = Math.max(min.height, start.height - dy)
    y = start.y + start.height - height
  }
  return { x, y, width, height }
}

/** Ajusta el rectángulo a la pantalla: no más grande que ella y con la barra superior alcanzable. */
export function clampRect(rect: FloatingRect, viewport: { width: number; height: number }): FloatingRect {
  const width = Math.min(rect.width, viewport.width)
  const height = Math.min(rect.height, viewport.height)
  const x = Math.min(Math.max(rect.x, VISIBLE_GRIP - width), viewport.width - VISIBLE_GRIP)
  const y = Math.min(Math.max(rect.y, 0), viewport.height - HEADER_HEIGHT)
  return { x, y, width, height }
}
