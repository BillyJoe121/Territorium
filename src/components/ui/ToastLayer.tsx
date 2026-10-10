import { useEffect, useRef, type ReactNode } from 'react'
import { Toaster, toast as sonnerToast, type ExternalToast } from 'sonner'

/**
 * Las hojas de cálculo (Univer) traen su propio contenedor de avisos de sonner, que mostraría
 * de nuevo, y sin botón para cerrarlos, todos los avisos de la aplicación. Los avisos de la
 * aplicación van solo a este contenedor.
 */
const APP_TOASTER_ID = 'territorium'

type Message = ReactNode
const withToaster = (data?: ExternalToast): ExternalToast => ({ ...data, toasterId: APP_TOASTER_ID })

/** Avisos de la aplicación: misma interfaz que el `toast` de sonner. */
export const toast = Object.assign(
  (message: Message, data?: ExternalToast) => sonnerToast(message, withToaster(data)),
  {
    success: (message: Message, data?: ExternalToast) => sonnerToast.success(message, withToaster(data)),
    info: (message: Message, data?: ExternalToast) => sonnerToast.info(message, withToaster(data)),
    warning: (message: Message, data?: ExternalToast) => sonnerToast.warning(message, withToaster(data)),
    error: (message: Message, data?: ExternalToast) => sonnerToast.error(message, withToaster(data)),
    dismiss: (id?: number | string) => sonnerToast.dismiss(id),
  },
)

/**
 * Avisos con botón para cerrarlos.
 *
 * Los modales Radix tratan cualquier pulsación fuera de ellos como "cerrar el modal" y
 * desactivan el puntero en el resto de la página. Los avisos viven fuera del modal, así que
 * sus pulsaciones y su foco no se propagan: cerrar un aviso no cierra el modal abierto.
 */
export function ToastLayer() {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const isolate = (event: Event) => event.stopPropagation()
    layer.addEventListener('pointerdown', isolate)
    layer.addEventListener('focusin', isolate)
    return () => {
      layer.removeEventListener('pointerdown', isolate)
      layer.removeEventListener('focusin', isolate)
    }
  }, [])

  return (
    <div ref={layerRef} className="toast-layer">
      <Toaster
        id={APP_TOASTER_ID}
        richColors
        closeButton
        position="top-right"
        containerAriaLabel="Notificaciones"
        toastOptions={{ closeButtonAriaLabel: 'Cerrar notificación' }}
      />
    </div>
  )
}
