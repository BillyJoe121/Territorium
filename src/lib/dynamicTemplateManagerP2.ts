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
