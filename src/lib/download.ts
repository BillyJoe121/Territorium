/** Descarga un archivo generado en el navegador con el nombre indicado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Nombres sin repetir para un .zip: si dos archivos se llaman igual (p. ej. el mismo documento
 * cargado dos veces), el segundo queda como "nombre (2).pdf" y ninguno se pierde.
 */
export function uniqueFileNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    const dot = name.lastIndexOf('.')
    const [base, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
    let candidate = name
    for (let copy = 2; used.has(candidate.toLowerCase()); copy++) candidate = `${base} (${copy})${extension}`
    used.add(candidate.toLowerCase())
    return candidate
  })
}

/** Empaqueta los archivos en un .zip (JSZip se carga solo cuando se usa). */
export async function buildZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const names = uniqueFileNames(files.map((file) => file.name))
  files.forEach((file, index) => zip.file(names[index], file.blob))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
