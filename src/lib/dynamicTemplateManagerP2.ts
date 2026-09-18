import type { CustomDynamicTemplate } from '../types'

/**
 * US-128: Extrae marcadores de posición (placeholders) tipo {{variable}} o [VARIABLE] de una plantilla.
 */
export function extractPlaceholdersFromTemplate(content: string): string[] {
  const placeholders = new Set<string>()

  // 1. Patrón {{variable}}
  const curlyRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let match: RegExpExecArray | null
  while ((match = curlyRegex.exec(content)) !== null) {
    placeholders.add(match[1])
  }

  // 2. Patrón [VARIABLE]
  const squareRegex = /\[([A-Z0-9_]{3,})\]/g
  while ((match = squareRegex.exec(content)) !== null) {
    placeholders.add(match[1].toLowerCase())
  }

  return Array.from(placeholders)
}

/**
 * US-128: Registra una nueva plantilla dinámica detectando sus variables sin modificar código.
 */
export function createDynamicTemplate(input: {
  projectId: string
  templateKey: string
  name: string
  description?: string
  format?: 'txt' | 'docx' | 'xlsx'
  rawContent: string
  initialMappings?: Record<string, string>
  authorId?: string
}): CustomDynamicTemplate {
  const placeholders = extractPlaceholdersFromTemplate(input.rawContent)
  const defaultMappings: Record<string, string> = {}

  for (const ph of placeholders) {
    defaultMappings[ph] = input.initialMappings?.[ph] || ph
  }

  const now = new Date().toISOString()

  return {
    id: `dyn-tmpl-${input.templateKey}-${Date.now()}`,
    projectId: input.projectId,
    templateKey: input.templateKey,
    name: input.name,
    description: input.description,
    format: input.format || 'txt',
    rawContent: input.rawContent,
    detectedPlaceholders: placeholders,
    fieldMappings: defaultMappings,
    isActive: true,
    version: 1,
    createdBy: input.authorId ?? null,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * US-128: Renderiza una plantilla dinámica con datos de la mesa maestra predial.
 */
export function renderDynamicTemplate(
  template: CustomDynamicTemplate,
  propertyAttributes: Record<string, any>
): {
  renderedContent: string
  unresolvedPlaceholders: string[]
  success: boolean
} {
  let content = template.rawContent
  const unresolved: string[] = []

  for (const placeholder of template.detectedPlaceholders) {
    const attributeKey = template.fieldMappings[placeholder] || placeholder
    const attrValue = propertyAttributes[attributeKey]

    const valToInject =
      attrValue !== undefined && attrValue !== null && String(attrValue).trim() !== ''
        ? String(attrValue)
        : null

    if (valToInject !== null) {
      // Reemplazar {{placeholder}}
      const curlyPattern = new RegExp(`\\{\\{\\s*${placeholder}\\s*\\}\\}`, 'gi')
      content = content.replace(curlyPattern, valToInject)

      // Reemplazar [PLACEHOLDER]
      const squarePattern = new RegExp(`\\[${placeholder}\\]`, 'gi')
      content = content.replace(squarePattern, valToInject)
    } else {
      unresolved.push(placeholder)
    }
  }

  return {
    renderedContent: content,
    unresolvedPlaceholders: unresolved,
    success: unresolved.length === 0
  }
}

/**
 * US-128: Procesa plantillas Word (.docx) reales sustituyendo variables dinámicas
 * en el documento XML (word/document.xml) y reempaquetando el archivo binario válido.
 */
export async function renderDocxTemplate(
  docxTemplateBufferOrRecord: any,
  fieldValues: Record<string, any>
): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default
  let zip = new JSZip()

  let bufferToLoad: any = null
  if (docxTemplateBufferOrRecord instanceof Uint8Array || docxTemplateBufferOrRecord instanceof ArrayBuffer) {
    bufferToLoad = docxTemplateBufferOrRecord
  }

  let docXmlContent = ''
  if (bufferToLoad) {
    try {
      const loaded = await zip.loadAsync(bufferToLoad)
      const docXml = loaded.files['word/document.xml']
      if (docXml) {
        docXmlContent = await docXml.async('text')
      }
    } catch {
      // Fallback to building standard document XML
    }
  }

  if (!docXmlContent) {
    docXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>PLANTILLA JURÍDICA TERRITORIUM</w:t></w:r></w:p>
    ${Object.keys(fieldValues).map((k) => `<w:p><w:r><w:t>${k}: {{${k}}}</w:t></w:r></w:p>`).join('\n')}
  </w:body>
</w:document>`
    zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  }

  for (const [key, val] of Object.entries(fieldValues)) {
    const valueStr = val !== undefined && val !== null ? String(val) : ''
    const curlyPattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    const squarePattern = new RegExp(`\\[${key.toUpperCase()}\\]`, 'g')
    docXmlContent = docXmlContent.replace(curlyPattern, valueStr)
    docXmlContent = docXmlContent.replace(squarePattern, valueStr)
  }

  zip.file('word/document.xml', docXmlContent)
  return await zip.generateAsync({ type: 'uint8array' })
}

