import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from '../expedienteConsolidation'
import { createParagraph, createHeading, createMultiColumnTable, normalizeConsolidatedRecord } from './nodes'
import type { DocumentCompilerOptions } from './types'

/**
 * Compiles the exact representation of ID02 descripción de linderos.docx
 */
export function compileDescripcionLinderosNodes(
  rawRecord: ConsolidatedMasterRecord,
  _options: DocumentCompilerOptions,
): JSONContent[] {
  const record = normalizeConsolidatedRecord(rawRecord)
  const easementAreaLetters = record.easement_area_letters || record.easement_area
  const easementLengthLetters = record.easement_length_letters || record.easement_length
  const easementWidthLetters = record.easement_width_letters || record.easement_width

  return [
    createHeading(1, 'FICHA TÉCNICA DE DESCRIPCIÓN DE LINDEROS DE SERVIDUMBRE'),
    createParagraph(
      `La franja o faja de servidumbre tiene un área de ${easementAreaLetters} (${record.easement_area} m2) aproximadamente, que corresponde a ${easementLengthLetters} (${record.easement_length} m) de longitud y ${easementWidthLetters} (${record.easement_width} m) de ancho, y sus linderos son:`,
    ),

    createHeading(2, '1. Descripción de Vértices de Servidumbre por Tramos'),
    createParagraph('La descripción de vértices de servidumbre se define por tres tramos, a continuación, el Tramo 1 se define:'),
    createParagraph(
      `NORTE: Inicia en el vértice 1 con coordenadas “N: 2124501.376 y E: 4789744.45”, en línea recta en sentido noreste, pasando por el vértice 2 con coordenadas “N: 2124588.774 y E: 4790022.826” y una distancia de 291.77 metros colindando con el predio denominado ${record.property_name}.`,
    ),
    createParagraph(
      'ESTE: Inicia en el vértice 2 con coordenadas “N: 2124588.774 y E: 4790022.826”, en línea recta en sentido sur, pasando por el vértice 3 con coordenadas “N: 2124555.414 y E: 4790023.403” y una distancia de 33.36 metros colindando con el predio colindante.',
    ),
    createParagraph(
      `SUR: Inicia en el vértice 3 con coordenadas “N: 2124555.414 y E: 4790023.403”, en línea recta en sentido suroeste, pasando por el vértice 4 con coordenadas “N: 2124489.186 y E: 4789812.452” y una distancia de 221.10 metros colindando con el predio denominado ${record.property_name}.`,
    ),
    createParagraph(
      'Desde el vértice 4 con coordenadas “N: 2124489.186 y E: 4789812.452”, en línea recta en sentido oeste, pasando por el vértice 5 con coordenadas “N: 2124490.176 y E: 4789764.575” y una distancia de 47.89 metros.',
    ),
    createParagraph(
      'Desde el vértice 5 con coordenadas “N: 2124490.176 y E: 4789764.575”, en línea recta en sentido oeste, pasando por el vértice 6 con coordenadas “N: 2124489.693 y E: 4789745.177” y una distancia de 19.40 metros.',
    ),
    createParagraph(
      'OESTE: Inicia en el vértice 6 con coordenadas “N: 2124489.693 y E: 4789745.177”, en línea recta en sentido norte, pasando por el vértice 1 con coordenadas “N: 2124501.376 y E: 4789744.45” y una distancia de 11.71 metros cerrando el polígono.',
    ),

    createParagraph('La descripción de vértices de servidumbre para el Tramo 2A se define:'),
    createParagraph(
      'NORTE: Inicia en el vértice 7 con coordenadas “N: 2124561.951 y E: 4790737.16”, en línea recta en sentido sureste, pasando por el vértice 8 con una distancia de 55.93 metros.',
    ),
    createParagraph(
      'ESTE: Inicia en el vértice 8 pasando por los vértices 9, 10, 11 y 12 colindando con la franja del proyecto.',
    ),
    createParagraph(
      `SUROESTE: Inicia en el vértice 12, en línea recta en sentido noroeste, pasando por el vértice 7 con una distancia de 89.04 metros colindando con el predio denominado ${record.property_name}.`,
    ),

    createParagraph('La descripción de vértices de servidumbre para el Tramo 2B se define:'),
    createParagraph(
      'NORTE: Inicia en el vértice 13 con coordenadas “N: 2124510.244 y E: 4790822.256”, pasando por el vértice 14 y 15.',
    ),
    createParagraph('ESTE: Inicia en el vértice 15 pasando por los vértices 16 y 17.'),
    createParagraph(
      `SUROESTE: Inicia en el vértice 17, en línea recta en sentido noroeste, cerrando en el vértice 13 con una distancia de 67.66 metros colindando con el predio denominado ${record.property_name}.`,
    ),

    createHeading(2, '2. Cuadros Técnicos de Coordenadas bajo Sistema CTM12'),
    createParagraph('TABLA DE COORDENADAS VÉRTICES DE SERVIDUMBRE TRAMO 1'),
    createMultiColumnTable(
      ['VÉRTICE', 'NORTE (m)', 'ESTE (m)', 'SEGMENTO', 'DISTANCIA (m)'],
      [
        ['1', '2124501.376', '4789744.450', '—', '—'],
        ['2', '2124588.774', '4790022.826', '1-2', '291.77'],
        ['3', '2124555.414', '4790023.403', '2-3', '33.36'],
        ['4', '2124489.186', '4789812.452', '3-4', '221.10'],
        ['5', '2124490.176', '4789764.575', '4-5', '47.89'],
        ['6', '2124489.693', '4789745.177', '5-6', '19.40'],
        ['1', '2124501.376', '4789744.450', '6-1', '11.71'],
      ],
      [110, 140, 140, 120, 140],
    ),

    createParagraph('TABLA DE COORDENADAS VÉRTICES DE SERVIDUMBRE TRAMO 2A'),
    createMultiColumnTable(
      ['VÉRTICE', 'NORTE (m)', 'ESTE (m)', 'SEGMENTO', 'DISTANCIA (m)'],
      [
        ['7', '2124561.951', '4790737.160', '—', '—'],
        ['8', '2124551.061', '4790792.018', '7-8', '55.93'],
        ['9', '2124537.403', '4790813.957', '8-9', '25.84'],
        ['10', '2124535.627', '4790810.702', '9-10', '3.71'],
        ['11', '2124523.454', '4790806.746', '10-11', '12.80'],
        ['12', '2124515.595', '4790813.179', '11-12', '10.16'],
        ['7', '2124561.951', '4790737.160', '12-7', '89.04'],
      ],
      [110, 140, 140, 120, 140],
    ),

    createParagraph('TABLA DE COORDENADAS VÉRTICES DE SERVIDUMBRE TRAMO 2B'),
    createMultiColumnTable(
      ['VÉRTICE', 'NORTE (m)', 'ESTE (m)', 'SEGMENTO', 'DISTANCIA (m)'],
      [
        ['13', '2124510.244', '4790822.256', '—', '—'],
        ['14', '2124506.410', '4790841.833', '13-14', '19.95'],
        ['15', '2124503.395', '4790859.357', '14-15', '17.78'],
        ['16', '2124492.519', '4790869.085', '15-16', '14.59'],
        ['17', '2124475.887', '4790880.545', '16-17', '20.20'],
        ['13', '2124510.244', '4790822.256', '17-13', '67.66'],
      ],
      [110, 140, 140, 120, 140],
    ),

    createHeading(2, '3. Parámetros Técnicos y Cartográficos'),
    createParagraph(
      `PARÁGRAFO PRIMERO: Lo anterior de conformidad con el Plano denominado ${record.plan_name}, elaborado por TERRITORIUM S.A.S. a escala ${record.plan_scale}.`,
    ),
    createParagraph(
      `PARÁGRAFO SEGUNDO: Sobre la franja de servidumbre descrita, se cuenta con ${record.infrastructure_count} infraestructura(s) de apoyo.`,
    ),
  ]
}
