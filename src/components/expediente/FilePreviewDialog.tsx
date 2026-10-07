import * as Dialog from '@radix-ui/react-dialog'
import { OriginalViewer, type ViewerDocument } from '../comparison/OriginalViewer'

export interface FilePreviewTarget {
  document: ViewerDocument
  /** Para archivos que aún no están en el bucket (p. ej. el modo prototipo). */
  loadBlob?: () => Promise<Blob>
}

interface Props {
  target: FilePreviewTarget | null
  onClose: () => void
}

/** Modal del tamaño de las tablas de revisión con solo el visor del comparador. */
export function FilePreviewDialog({ target, onClose }: Props) {
  return (
    <Dialog.Root open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="expediente-modal-overlay" />
        <Dialog.Content className="expediente-review-modal expediente-file-preview-modal" aria-describedby={undefined}>
          {/* Solo para lectores de pantalla: el modal muestra únicamente el visor. */}
          <Dialog.Title className="sr-only">{target ? `Vista previa de ${target.document.original_name}` : 'Vista previa'}</Dialog.Title>
          {target && (
            <OriginalViewer
              key={target.document.id}
              document={target.document}
              loadBlob={target.loadBlob}
              variant="preview"
              onClose={onClose}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
