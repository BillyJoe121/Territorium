import { describe, expect, it } from 'vitest'
import { clampRect, resizeRect } from './floatingRect'

const start = { x: 100, y: 50, width: 800, height: 600 }
const viewport = { width: 1440, height: 900 }

describe('resizeRect', () => {
  it('agranda desde el borde derecho e inferior sin mover la esquina superior izquierda', () => {
    expect(resizeRect(start, 'se', 40, 30)).toEqual({ x: 100, y: 50, width: 840, height: 630 })
  })

  it('desde el borde izquierdo y superior mantiene fijo el borde opuesto', () => {
    expect(resizeRect(start, 'nw', 50, 20)).toEqual({ x: 150, y: 70, width: 750, height: 580 })
  })

  it('no baja del tamaño mínimo y el borde opuesto sigue fijo', () => {
    const shrunk = resizeRect(start, 'w', 1000, 0)
    expect(shrunk.width).toBe(420)
    expect(shrunk.x + shrunk.width).toBe(start.x + start.width)
    expect(resizeRect(start, 'n', 0, 1000).height).toBe(320)
  })

  it('un borde lateral no cambia la altura', () => {
    expect(resizeRect(start, 'e', 25, 300)).toEqual({ x: 100, y: 50, width: 825, height: 600 })
  })
})

describe('clampRect', () => {
  it('deja la barra superior alcanzable aunque se arrastre fuera de la pantalla', () => {
    expect(clampRect({ ...start, x: -2000, y: -300 }, viewport)).toEqual({ x: 120 - 800, y: 0, width: 800, height: 600 })
    expect(clampRect({ ...start, x: 5000, y: 5000 }, viewport)).toEqual({ x: 1440 - 120, y: 900 - 48, width: 800, height: 600 })
  })

  it('no permite un tamaño mayor que la pantalla', () => {
    const rect = clampRect({ x: 0, y: 0, width: 3000, height: 2000 }, viewport)
    expect(rect.width).toBe(1440)
    expect(rect.height).toBe(900)
  })
})
