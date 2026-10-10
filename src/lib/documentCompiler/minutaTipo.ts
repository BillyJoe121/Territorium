import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from '../expedienteConsolidation'
import { createParagraph, createHeading, createMultiColumnTable, normalizeConsolidatedRecord } from './nodes'
import type { DocumentCompilerOptions } from './types'

/**
 * Compiles the exact representation of MINUTA_TIPO_TERRITORIUM.doc
 */
export function compileMinutaTipoTerritoriumNodes(
  rawRecord: ConsolidatedMasterRecord,
  _options: DocumentCompilerOptions,
): JSONContent[] {
  const record = normalizeConsolidatedRecord(rawRecord)
  const currentYear = new Date().getFullYear().toString()
  const currentMonth = new Date().toLocaleDateString('es-CO', { month: 'long' })
  const offerLetters = record.first_offer_letters || record.first_offer
  const offerNumbers = record.first_offer || '0'
  const areaNumbers = record.area_numbers || '—'
  const easementAreaLetters = record.easement_area_letters || record.easement_area
  const easementLengthLetters = record.easement_length_letters || record.easement_length
  const easementWidthLetters = record.easement_width_letters || record.easement_width

  return [
    createHeading(1, 'MINUTA TIPO TERRITORIUM — CONSTITUCIÓN DE SERVIDUMBRE'),
    createParagraph(`NOTARIA DEL CÍRCULO DE ${record.municipality.toUpperCase()}`),
    createParagraph('ESCRITURA PÚBLICA NÚMERO: ——————————————————————'),
    createParagraph(`FECHA: ${currentMonth.toUpperCase()} DE ${currentYear}`),
    createHeading(2, 'SUPERINTENDENCIA DE NOTARIADO Y REGISTRO — SÍNTESIS DE CONTENIDO'),

    // Table 0: Acto
    createMultiColumnTable(
      ['CLASE DEL ACTO', 'CÓDIGO', 'CUANTÍA'],
      [
        [
          'SERVIDUMBRE LEGAL DE LÍNEAS DE DISTRIBUCIÓN DE ENERGÍA ELÉCTRICA DE CARÁCTER PERMANENTE Y A PERPETUIDAD',
          '0339',
          `$ ${offerNumbers}`,
        ],
        ['RENUNCIA A LA CONDICIÓN RESOLUTORIA', '0413', 'SIN CUANTÍA'],
        ['PODER ESPECIAL', '0546', 'SIN CUANTÍA'],
      ],
      [360, 110, 180],
    ),

    // Table 1: Documento
    createMultiColumnTable(
      ['CLASE', 'NÚMERO', 'FECHA', 'OFICINA DE ORIGEN', 'CIUDAD'],
      [
        [
          'ESCRITURA',
          '—',
          `${currentMonth.toUpperCase()} DE ${currentYear}`,
          `NOTARÍA DEL CÍRCULO DE ${record.municipality.toUpperCase()}`,
          record.municipality.toUpperCase(),
        ],
      ],
      [110, 100, 140, 210, 120],
    ),

    // Table 2: Personas que intervienen
    createMultiColumnTable(
      ['ROL EN EL ACTO', 'NOMBRE / RAZÓN SOCIAL', 'NÚMERO DE IDENTIFICACIÓN'],
      [
        ['OTORGANTE (PROPIETARIO)', record.owners, 'Cédula(s) según registro'],
        ['OTORGANTE BENEFICIARIA', 'PARQUE SOLAR PUERTA DE ORO S.A.S. E.S.P.', 'NIT. 901.162.561-3'],
        ['REPRESENTANTE LEGAL SUPLENTE', 'MAURICIO JOSÉ BAEZ ATUESTA', 'C.C. 1.098.637.307'],
      ],
      [200, 280, 200],
    ),

    // Table 3: Identificación de bienes
    createMultiColumnTable(
      ['PARÁMETRO REGISTRAL', 'DESCRIPCIÓN / VALOR CONSOLIDADO'],
      [
        ['MATRÍCULA INMOBILIARIA No.', record.folio],
        ['TIPO DE PREDIO', 'RURAL (X)'],
        ['CÓDIGO CATASTRAL', record.cadastral_id],
        ['DIRECCIÓN / PREDIO', record.property_name],
        ['MUNICIPIO', record.municipality],
        ['DEPARTAMENTO', record.department],
      ],
      [240, 440],
    ),

    createHeading(2, 'COMPARECENCIA'),
    createParagraph(
      `En la ciudad de ${record.municipality}, Departamento de ${record.department}, República de Colombia, comparecieron por una parte: ${record.owners}, en adelante “LAS PROPIETARIAS”; y de la otra parte MAURICIO JOSÉ BAEZ ATUESTA, identificado con la cédula de ciudadanía No. 1.098.637.307, Representante Legal Suplente de PARQUE SOLAR PUERTA DE ORO S.A.S. E.S.P. (NIT. 901.162.561-3), en adelante “LA BENEFICIARIA”, y conjuntamente “LAS PARTES”, manifestaron que han convenido celebrar el presente contrato de constitución de servidumbre legal, permanente y a perpetuidad de distribución de energía eléctrica, previas las siguientes consideraciones:`,
    ),

    createHeading(2, 'CONSIDERACIONES PRELIMINARES'),
    createParagraph(
      'PARQUE SOLAR PUERTA DE ORO S.A.S. E.S.P. es propietaria del Proyecto de generación de energía solar denominado “PARQUE SOLAR PUERTA DE ORO 300 MW”. Para entregar la energía eléctrica al Sistema Interconectado Nacional (SIN), se requiere de una línea de transmisión a nivel de 230 kV conectada a la Subestación San Felipe.',
    ),
    createParagraph(
      `El inmueble denominado “${record.property_name}”, identificado con la matrícula inmobiliaria ${record.folio} y la cédula catastral ${record.cadastral_id}, ubicado en ${record.municipality} - ${record.department}, cuyo dominio está en cabeza de LAS PROPIETARIAS, es requerido por el Proyecto para la construcción de la línea, acordando celebrar el contrato bajo las siguientes:`,
    ),

    createHeading(2, 'CLÁUSULAS CONTRACTUALES'),
    createHeading(3, 'PRIMERA: Inmueble y Linderos Generales'),
    createParagraph(
      `LAS PROPIETARIAS son dueñas y poseedoras del inmueble denominado “${record.property_name}”, identificado con la matrícula inmobiliaria ${record.folio} de la ORIP de ${record.registry_office || record.municipality} y cédula catastral ${record.cadastral_id}, con un área general de ${areaNumbers}, cuyos linderos generales son: ${record.boundaries}.`,
    ),

    createHeading(3, 'SEGUNDA: Tradición'),
    createParagraph(
      `LAS PROPIETARIAS adquirieron el inmueble antes descrito por ${record.acquisition_mode}, debidamente registrada en el folio de matrícula inmobiliaria ${record.folio}.`,
    ),

    createHeading(3, 'TERCERA: Constitución de Servidumbre'),
    createParagraph(
      `LAS PROPIETARIAS constituyen a favor de PARQUE SOLAR PUERTA DE ORO S.A.S. E.S.P. servidumbre legal, permanente y a perpetuidad de distribución de energía eléctrica sobre una franja de terreno con área total de ${easementAreaLetters} (${record.easement_area} m²), longitud de ${easementLengthLetters} (${record.easement_length} m) y ancho de ${easementWidthLetters} (${record.easement_width} m).`,
    ),
    createParagraph('Los linderos de la servidumbre se enmarcan en el siguiente cuadro de coordenadas bajo el sistema CTM12:'),
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
    createParagraph(
      `PARÁGRAFO PRIMERO: Lo anterior de conformidad con el Plano denominado ${record.plan_name}, elaborado por TERRITORIUM S.A.S. a escala ${record.plan_scale}.`,
    ),
    createParagraph(
      `PARÁGRAFO SEGUNDO: Sobre las franjas de servidumbre descritas, se proyectan ${record.infrastructure_count} infraestructuras de apoyo.`,
    ),

    createHeading(3, 'CUARTA: Derechos y Obligaciones de las Partes'),
    createParagraph(
      'LA BENEFICIARIA utilizará la franja de servidumbre para transitar, construir, reparar y mantener las líneas de energía eléctrica, dando aviso previo y procurando causar el menor daño posible.',
    ),

    createHeading(3, 'QUINTA: Autorización de Obras'),
    createParagraph('LAS PROPIETARIAS autorizan a LA BENEFICIARIA para realizar adecuaciones de terreno, movimientos de tierra y obras necesarias.'),

    createHeading(3, 'SEXTA: Responsabilidad Ambiental'),
    createParagraph('LA BENEFICIARIA cumplirá con las normas ambientales y asumirá los daños imputables causados fuera del área de servidumbre.'),

    createHeading(3, 'SÉPTIMA: Entrega Material'),
    createParagraph('LAS PROPIETARIAS entregan real y materialmente a LA BENEFICIARIA la franja gravada con la servidumbre.'),

    createHeading(3, 'OCTAVA: Restricciones RETIE'),
    createParagraph('Obligación de respetar distancias de seguridad del RETIE, prohibición de edificaciones y compatibilidad con labores agrícolas manuales.'),

    createHeading(3, 'NOVENA: Poda y Remoción'),
    createParagraph('Autorización para podar o talar vegetación que ponga en peligro la continuidad del servicio.'),

    createHeading(3, 'DÉCIMA: Facultades Específicas'),
    createParagraph('Facultades para tender líneas, construir carreteables provisionales, remover obstáculos y vigilar las instalaciones.'),

    createHeading(3, 'DÉCIMA PRIMERA: Mantenimiento'),
    createParagraph('Mantenimiento y reparación a cargo exclusivo de la BENEFICIARIA.'),

    createHeading(3, 'DÉCIMA SEGUNDA: Saneamiento y Libertad de Gravámenes'),
    createParagraph(
      `El inmueble se encuentra libre de limitaciones y pleitos pendientes, salvo: ${record.legal_conditions || 'ninguna afección'}. Sin solicitudes en registro de tierras despojadas (Radicado URT: ${record.urt_case || 'Sin antecedentes'}).`,
    ),

    createHeading(3, 'DÉCIMA TERCERA: Declaración de Origen de Fondos'),
    createParagraph('Declaración de licitud de fondos y ausencia de antecedentes en listas OFAC/ONU.'),

    createHeading(3, 'DÉCIMA CUARTA: Precio y Forma de Pago'),
    createParagraph(
      `LA BENEFICIARIA pagará a LAS PROPIETARIAS como contraprestación total la suma de ${offerLetters} ($ ${offerNumbers}), pagadera por hitos de firma y registro.`,
    ),
    createParagraph('PARÁGRAFO: LAS PROPIETARIAS renuncian a la condición resolutoria derivada de la forma de pago.'),

    createHeading(3, 'DÉCIMA QUINTA a DÉCIMA NOVENA: Disposiciones Finales'),
    createParagraph('DÉCIMA QUINTA: Paz y salvo predial e impuestos.'),
    createParagraph('DÉCIMA SEXTA: Gastos notariales y de registro a cargo de LA BENEFICIARIA.'),
    createParagraph(`DÉCIMA SÉPTIMA: Solicitud formal de registro en el folio de matrícula ${record.folio}.`),
    createParagraph('DÉCIMA NOVENA: Poder especial amplio y suficiente para trámites registrales.'),

    createHeading(2, 'COMPROBANTES LEGALES Y OTORGAMIENTO'),
    createParagraph(`Paz y salvo predial municipal, certificado de tradición FMI ${record.folio} y planos de servidumbre.`),
    createParagraph('Leída la presente escritura por los comparecientes, la aceptaron por encontrarla conforme y firman ante el Notario.'),

    createHeading(2, 'FIRMAS'),
    createParagraph('________________________________________________________'),
    createParagraph(record.owners, 'OTORGANTE (PROPIETARIO): '),
    createParagraph('________________________________________________________'),
    createParagraph('MAURICIO JOSÉ BAEZ ATUESTA — C.C. 1.098.637.307', 'REPRESENTANTE LEGAL SUPLENTE: '),
    createParagraph('PARQUE SOLAR PUERTA DE ORO S.A.S. E.S.P. — NIT. 901.162.561-3'),
  ]
}
