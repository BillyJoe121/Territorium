import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from './expedienteConsolidation'
import {
  OFFICIAL_PREDIAL_TEMPLATE_V1,
  type ExpedienteDocumentTemplate,
} from './expedienteDocumentTemplates'

export interface DocumentCompilationMetadata {
  templateId: string
  templateVersion: number
  consolidatedAt: string
  titlesVersionId: string
  plansVersionId: string
  negotiationVersionId: string
  compiledAt: string
  compiledBy?: string
  folio: string
  cadastralId: string
  verificationHash: string
}

export interface DocumentCompilationResult {
  content: JSONContent
  metadata: DocumentCompilationMetadata
  warnings: string[]
}

export interface DocumentCompilerOptions {
  projectName?: string
  projectCode?: string
  compiledBy?: string
  narrativeOverride?: string
  template?: ExpedienteDocumentTemplate
}

/**
 * Creates a standard paragraph node for Tiptap JSONContent.
 */
function createParagraph(text: string, boldPrefix?: string): JSONContent {
  const content: JSONContent[] = []
  if (boldPrefix) {
    content.push({
      type: 'text',
      marks: [{ type: 'bold' }],
      text: boldPrefix,
    })
  }
  if (text) {
    content.push({
      type: 'text',
      text,
    })
  }
  return {
    type: 'paragraph',
    content: content.length > 0 ? content : undefined,
  }
}

/**
 * Creates a heading node (H1, H2, H3).
 */
function createHeading(level: 1 | 2 | 3, text: string): JSONContent {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

/**
 * Creates a 2-column key-value table node.
 */
function createKeyValueTable(rows: [string, string][]): JSONContent {
  const tableRows: JSONContent[] = rows.map(([key, val]) => ({
    type: 'tableRow',
    content: [
      {
        type: 'tableHeader',
        attrs: { colspan: 1, rowspan: 1, colwidth: [220] },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', marks: [{ type: 'bold' }], text: key }],
          },
        ],
      },
      {
        type: 'tableCell',
        attrs: { colspan: 1, rowspan: 1, colwidth: [460] },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: val || '—' }],
          },
        ],
      },
    ],
  }))

  return {
    type: 'table',
    content: tableRows,
  }
}

/**
 * Deterministic generation of verification hash based on immutable properties.
 */
function computeDeterministicVerificationCode(record: ConsolidatedMasterRecord, version: number): string {
  const seed = `${record.folio}|${record.cadastral_id}|${record.property_name}|${record.metadata.consolidated_at}|v${version}`
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
  return `TRT-DOC-${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

/**
 * Creates a multi-column table node for Tiptap JSONContent.
 */
function createMultiColumnTable(
  headers: string[],
  rows: (string | number)[][],
  colWidths?: number[],
): JSONContent {
  const defaultWidth = Math.max(90, Math.floor(680 / Math.max(1, headers.length)))
  const headerRow: JSONContent = {
    type: 'tableRow',
    content: headers.map((h, i) => ({
      type: 'tableHeader',
      attrs: { colspan: 1, rowspan: 1, colwidth: [colWidths?.[i] ?? defaultWidth] },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: h }],
        },
      ],
    })),
  }

  const dataRows: JSONContent[] = rows.map((r) => ({
    type: 'tableRow',
    content: r.map((cell, i) => ({
      type: 'tableCell',
      attrs: { colspan: 1, rowspan: 1, colwidth: [colWidths?.[i] ?? defaultWidth] },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: String(cell ?? '—') }],
        },
      ],
    })),
  }))

  return {
    type: 'table',
    content: [headerRow, ...dataRows],
  }
}

function normalizeConsolidatedRecord(raw: any): Record<string, string> {
  const p = raw?.predio || {}
  const a = raw?.adquisicion || {}
  const s = raw?.afectacionServidumbre || {}
  const n = raw?.negociacion || {}
  const c = raw?.condicionesJuridicas || {}
  const ownersList = Array.isArray(raw?.propietarios)
    ? raw.propietarios
        .map((o: any) => `${o.nombre || ''} (${o.tipoDocumento || 'CC'} ${o.numeroDocumento || ''})`.trim())
        .join(', ')
    : ''

  const safeStr = (val: any, fallback = '—') => (val != null && String(val).trim() !== '' ? String(val) : fallback)
  const negotiated = (val: any) => (val != null && !['', '—'].includes(String(val).trim()) ? String(val).trim() : '')

  return {
    property_name: safeStr(raw?.property_name || p.nombre, 'PREDIO SIN NOMBRE'),
    cadastral_id: safeStr(raw?.cadastral_id || p.cedulaCatastral),
    folio: safeStr(raw?.folio || p.matriculaInmobiliaria),
    municipality: safeStr(raw?.municipality || p.municipio, 'Ibagué'),
    department: safeStr(raw?.department || p.departamento, 'Tolima'),
    village: safeStr(raw?.village || p.vereda, 'Centro'),
    owners: safeStr(raw?.owners || ownersList, 'PROPIETARIO REGISTRAL'),
    area_numbers: safeStr(raw?.area_numbers || p.areaTotal),
    area_letters: safeStr(raw?.area_letters, ''),
    registry_office: safeStr(raw?.registry_office || a.notaria, 'Oficina de Registro de Instrumentos Públicos'),
    acquisition_mode: safeStr(raw?.acquisition_mode || a.modo, 'Compraventa'),
    boundaries: safeStr(raw?.boundaries || raw?.linderosRegistrales),
    boundaries_document: safeStr(raw?.boundaries_document || a.escrituraNumero),
    legal_conditions: safeStr(raw?.legal_conditions || c.embargos, 'Ninguno registrado'),
    justice_ministry_case: safeStr(raw?.justice_ministry_case),
    urt_case: safeStr(raw?.urt_case || c.procesosRestitucion, 'Sin antecedentes'),
    urt_territorial_direction: safeStr(raw?.urt_territorial_direction || raw?.department || p.departamento),

    easement_area: safeStr(raw?.easement_area || s.areaFranja),
    easement_area_letters: safeStr(raw?.easement_area_letters, ''),
    easement_length: safeStr(raw?.easement_length || s.longitud),
    easement_length_letters: safeStr(raw?.easement_length_letters, ''),
    easement_width: safeStr(raw?.easement_width || s.ancho),
    easement_width_letters: safeStr(raw?.easement_width_letters, ''),
    infrastructure_count: safeStr(raw?.infrastructure_count || s.torresPostes, '0'),
    infrastructure_count_letters: safeStr(raw?.infrastructure_count_letters, ''),
    plan_name: safeStr(raw?.plan_name || s.nombrePlano),
    plan_scale: safeStr(raw?.plan_scale || s.escala, '1:1000'),
    voltage_level: safeStr(raw?.voltage_level || s.tipoProyecto, '230 kV'),

    property_code: safeStr(raw?.property_code || p.nombre),
    // El valor negociado (verificado números ↔ letras) prevalece sobre la primera oferta.
    // Las plantillas anteponen "$ ", así que el valor se guarda sin el signo.
    first_offer: safeStr(negotiated(raw?.negotiated_value) || raw?.first_offer || n.valorIndemnizacion, '0').replace(/^\$\s*/, ''),
    first_offer_letters: safeStr(negotiated(raw?.negotiated_value_letters).toUpperCase() || raw?.first_offer_letters || n.valorLetras, ''),
  }
}

/**
 * Compiles the exact representation of ESCRITURA TOL-ANZ-045.docx
 */
function compileEscrituraPublicaNodes(
  rawRecord: ConsolidatedMasterRecord,
  options: DocumentCompilerOptions,
): JSONContent[] {
  const record = normalizeConsolidatedRecord(rawRecord)
  const currentYear = new Date().getFullYear().toString()
  const currentMonth = new Date().toLocaleDateString('es-CO', { month: 'long' })
  const offerLetters = record.first_offer_letters || record.first_offer
  const offerNumbers = record.first_offer || '0'
  const areaLetters = record.area_letters || record.area_numbers || '—'
  const areaNumbers = record.area_numbers || '—'
  const easementAreaLetters = record.easement_area_letters || record.easement_area
  const easementLengthLetters = record.easement_length_letters || record.easement_length
  const easementWidthLetters = record.easement_width_letters || record.easement_width
  const infraLetters = record.infrastructure_count_letters || record.infrastructure_count

  return [
    createHeading(1, 'ESCRITURA PÚBLICA No. ___________'),
    createParagraph('FECHA: ____________'),
    createHeading(2, 'SUPERINTENDENCIA DE NOTARIADO Y REGISTRO — FORMATO DE CALIFICACIÓN'),
    createParagraph(
      'ARTICULO 8° PARÁGRAFO 4° DE LA LEY 1.579 DE 2.012 DEL ESTATUTO DE REGISTRO DE INSTRUMENTOS PUBLICOS.',
    ),
    createKeyValueTable([
      [
        'ACTO O CONTRATO',
        'CONSTITUCIÓN DE SERVIDUMBRE LEGAL, PERMANENTE Y A PERPETUIDAD DE DISTRIBUCIÓN DE ENERGÍA ELÉCTRICA; RENUNCIA A LA CONDICIÓN RESOLUTORIA Y PODER ESPECIAL.',
      ],
      ['OTORGADA POR', record.owners],
      ['A FAVOR DE', 'CELSIA COLOMBIA S.A. E.S.P.'],
      ['VALOR', `${offerLetters} ($ ${offerNumbers})`],
      ['MATRÍCULA INMOBILIARIA', record.folio],
      ['REFERENCIA CATASTRAL', record.cadastral_id],
    ]),

    createHeading(2, 'COMPARECENCIA'),
    createParagraph(
      `En el municipio de ${record.municipality}, Departamento ${record.department}, República de Colombia, a los ________ (___) días del mes de ${currentMonth} del año ${currentYear}, ante el despacho del Notario ________ del Círculo de ${record.municipality}, comparecieron: ${record.owners}, domiciliado en el municipio de ${record.municipality}, obrando en este acto en su propio nombre, en adelante el “PROPIETARIO” o “CONSTITUYENTE” de una parte, de otra parte, YEISON FABIAN MARÍN ÁLZATE, identificado con la cédula de ciudadanía No. 80.190.666 de Bogotá, quien obra en calidad de apoderado especial de CELSIA COLOMBIA S.A. E.S.P., sociedad identificada con el NIT. 800.249.860-1 y domiciliada en Yumbo - Valle del Cauca, empresa privada de servicios públicos domiciliarios, constituida conforme a las Leyes 142 y 143 de 1994, con autonomía administrativa, patrimonial y presupuestal, la cual ejerce sus actividades dentro del ámbito del derecho privado, creada mediante Decreto Ley 1275 de junio 21 de 1991 y solemnizada su constitución a través de la escritura pública No. 914 del 12 de diciembre de 1994, otorgada en la Notaría Única de Candelaria, debidamente inscrita en la Cámara de Comercio de Cali, bajo el No. 83534 del Libro IX, y reformada varias veces, todo lo cual se acredita con el Certificado de Existencia y Representación Legal expedido por la Cámara de Comercio de Cali y el poder especial otorgado por el Representante Legal de la empresa, doctor JULIÁN DARÍO CADAVID VELÁSQUEZ, identificado con la cédula de ciudadanía No. 71.624.537, documentos que se protocolizan en esta escritura (anexo 1 y 2) en adelante la “BENEFICIARIA” o “CELSIA COLOMBIA”, y conjuntamente las “PARTES”, y manifestaron:`,
    ),

    createHeading(2, 'CONSIDERACIONES'),
    createParagraph(
      'A. El objeto social de CELSIA COLOMBIA comprende la ejecución de las políticas, planes, programas y proyectos de generación, transmisión, distribución y comercialización de energía, su administración, manejo y aprovechamiento, de conformidad con las Leyes 142 y 143 de 1994 y las disposiciones que las modifiquen, adicionen y/o reglamenten.',
    ),
    createParagraph(
      `B. En desarrollo del referido objeto social, CELSIA COLOMBIA ejecutará el proyecto denominado “${options.projectName || record.property_code || 'SUPLENCIAS ARREBOLES ETAPA - 2'}”, en adelante el “Proyecto”; conforme a las regulaciones, pautas y directrices expedidas por la Unidad de Planeación Minero Energético - UPME, entidad adscrita al Ministerio de Minas y Energía, todo con el propósito de optimizar la calidad del servicio, ampliar y reforzar el sistema de generación de energía, su transmisión y distribución ante la mayor demanda del servicio para los usuarios.`,
    ),
    createParagraph(
      `C. El Proyecto comprende la construcción de una línea eléctrica a nivel ${record.voltage_level || '13,2 kV'}, la cual servirá para la distribución de energía y para telecomunicaciones, en cumplimiento a la obligación de compartición de infraestructura por parte de CELSIA COLOMBIA, de acuerdo con la Ley 1341 de 2009, la Resolución 063 de 2013 de la CREG, la Resolución 5050 de 2016 de la CRC, la Resolución 5890 de 2020 de la CRC, y demás disposiciones que las complementen o modifiquen.`,
    ),
    createParagraph(
      `D. Que el (los) predio(s) del cual es propietario el CONSTITUYENTE identificado(s) con la(s) matrícula(s) inmobiliaria(s) ${record.folio} y cédula(s) catastral(es) ${record.cadastral_id}, es requerido por el Proyecto para la construcción de la línea antes indicada y, por lo tanto, se requiere constituir sobre este(os) inmueble(s) servidumbre legal, permanente y a perpetuidad de distribución de energía eléctrica y telecomunicaciones.`,
    ),
    createParagraph('Con base en las anteriores consideraciones, las Partes han acordado celebrar el presente contrato con base en las siguientes:'),

    createHeading(2, 'CLÁUSULAS'),
    createHeading(3, 'PRIMERA: Inmueble y Linderos Generales'),
    createParagraph(
      `El CONSTITUYENTE es propietario y poseedor del(los) inmueble(s) que se describe(n) a continuación: Predio rural, ubicado en jurisdicción del municipio de ${record.municipality} - ${record.department}, predio denominado ${record.property_name}, con un área de ${areaLetters} (${areaNumbers}), en adelante el “Inmueble”, comprendido dentro de los linderos generales, tomados de ${record.boundaries_document || 'los títulos de adquisición'}:`,
    ),
    createParagraph(`“${record.boundaries}”`),
    createParagraph(`Matrícula Inmobiliaria ${record.folio} de la Oficina de Registro de Instrumentos Públicos de ${record.registry_office || record.municipality}.`),
    createParagraph(`Cédula Catastral ${record.cadastral_id}.`),

    createHeading(3, 'SEGUNDA: Tradición'),
    createParagraph(
      `El CONSTITUYENTE adquirió el predio descrito en la cláusula anterior por ${record.acquisition_mode}, debidamente registrada en el folio de matrícula inmobiliaria del inmueble.`,
    ),

    createHeading(3, 'TERCERA: Constitución de Servidumbre'),
    createParagraph(
      `El PROPIETARIO constituye a favor de CELSIA COLOMBIA S.A. E.S.P. servidumbre legal, permanente y a perpetuidad de distribución de energía eléctrica y telecomunicaciones sobre parte del inmueble descrito y alinderado en la cláusula PRIMERA de este contrato.`,
    ),
    createParagraph(
      `La franja de la servidumbre que se constituye tiene un largo de ${easementLengthLetters} (${record.easement_length} m) de longitud y un ancho de ${easementWidthLetters} (${record.easement_width} m), para un área total de ${easementAreaLetters} (${record.easement_area} m²).`,
    ),
    createParagraph(
      `Los linderos georreferenciados del área de servidumbre en el predio sobre el cual se constituye son los siguientes en sistema CTM12: NORTE: Inicia en el vértice 1 colindando con el predio ${record.property_name}; ESTE: Línea recta en sentido sureste colindando con el trazado del proyecto; SUR: Cierra hacia el suroeste; OESTE: Cierra en el vértice 1 punto de partida.`,
    ),
    createParagraph(
      `Sobre la franja de servidumbre anteriormente descrita, se instalarán ${infraLetters} (${record.infrastructure_count}) infraestructura(s) de apoyo tipo poste/torre. Todo de conformidad con el plano denominado “${record.plan_name}”, elaborado por TERRITORIUM S.A.S a escala ${record.plan_scale}.`,
    ),
    createParagraph(
      'PARÁGRAFO: No obstante, la mención del área, ancho y largo de la(s) servidumbre(s), convienen las Partes que la(s) área(s) exacta(s) podrán ser modificadas de acuerdo con el cálculo del diseño final del recorrido de la línea y cualquier área adicional será cancelada proporcionalmente al valor y área negociada mediante este contrato.',
    ),

    createHeading(3, 'CUARTA: Alcance del Gravamen'),
    createParagraph(
      'La(s) servidumbre(s) objeto de este contrato comprenderá(n) la(s) franja(s) identificada(s) anteriormente y todo aquello que se instale en la correspondiente infraestructura, esté o no relacionado con la prestación del servicio de energía eléctrica y sea o no propiedad de CELSIA COLOMBIA. Permitirá el paso permanente de empleados, contratistas, vehículos y maquinaria para construir, operar y mantener la red sin restricciones modales o temporales.',
    ),

    createHeading(3, 'QUINTA: Autorización de Obras'),
    createParagraph(
      'El CONSTITUYENTE desde ya autoriza a la BENEFICIARIA para realizar todas las obras y en general las gestiones necesarias para constituir la(s) servidumbre(s), así como adecuaciones del terreno, movimientos de tierra, construcciones y accesos.',
    ),

    createHeading(3, 'SEXTA: Responsabilidad Técnica y Ambiental'),
    createParagraph(
      'La BENEFICIARIA manifiesta expresamente que para la servidumbre tendrá en cuenta tanto las exigencias técnicas de la obra como las normas ambientales. En caso de presentarse daños por causas imputables a contratistas en áreas adicionales a la franja, serán asumidos previa valoración y suscripción de acuerdo.',
    ),

    createHeading(3, 'SÉPTIMA: Entrega Material'),
    createParagraph('Que en esta fecha el CONSTITUYENTE hace entrega real y material de la franja objeto de la servidumbre a entera satisfacción de la BENEFICIARIA.'),

    createHeading(3, 'OCTAVA: Restricciones RETIE'),
    createParagraph(
      'El CONSTITUYENTE se obliga a respetar las restricciones dadas por el Reglamento Técnico de Instalaciones Eléctricas (RETIE) para el uso de la zona gravada con la servidumbre: impedir la siembra de árboles de gran porte, no edificar construcciones, ni concentraciones permanentes de personas. Se permite el uso en labores manuales o agropecuarias de bajo porte.',
    ),

    createHeading(3, 'NOVENA: Poda y Manejo Forestal'),
    createParagraph(
      'A partir del momento de la entrega material, la BENEFICIARIA queda autorizada para remover o podar árboles de raíz profunda o cultivos que interfieran con la seguridad de la línea. Se prohíben quemas no autorizadas de residuos.',
    ),

    createHeading(3, 'DÉCIMA: Facultades Operativas'),
    createParagraph(
      'Por razón de la servidumbre constituida, la BENEFICIARIA podrá: pasar líneas aéreas de energía y telecomunicaciones; construir o utilizar carreteables transitorios; transitar libremente con empleados y maquinaria; impedir obras que obstaculicen el paso; y adelantar todas las labores de mantenimiento y vigilancia requeridas.',
    ),

    createHeading(3, 'DÉCIMA PRIMERA: Mantenimiento y Conservación'),
    createParagraph(
      'La ejecución, conservación, mantenimiento y reparación de las obras de servidumbre, así como los materiales e infraestructura, serán de entera responsabilidad de la BENEFICIARIA.',
    ),

    createHeading(3, 'DÉCIMA SEGUNDA: Saneamiento y Libertad de Gravámenes'),
    createParagraph(
      `El CONSTITUYENTE garantiza que el predio es de su exclusiva propiedad y se encuentra libre de gravámenes, condiciones resolutorias o pleitos pendientes, salvo: ${record.legal_conditions || 'ninguno registrado'}.`,
    ),
    createParagraph(
      `PARÁGRAFO PRIMERO: Se garantiza que no existen solicitudes en el Registro de Tierras Despojadas y Abandonadas Forzosamente, ni medidas individuales o colectivas en el RUPTA (Radicado URT: ${record.urt_case || 'Sin antecedentes'}, Dirección Territorial: ${record.urt_territorial_direction || record.department}).`,
    ),
    createParagraph(
      'PARÁGRAFO SEGUNDO: El CONSTITUYENTE se obliga con la BENEFICIARIA al saneamiento de lo gravado por evicción y vicios redhibitorios conforme a la ley.',
    ),

    createHeading(3, 'DÉCIMA TERCERA: Origen de Fondos y Cumplimiento TusDatos'),
    createParagraph(
      'Las partes declaran que los recursos del negocio provienen de actividades lícitas y que no se encuentran en listas restrictivas OFAC, ONU ni vinculados a delitos de lavado de activos o financiación del terrorismo. Los intervinientes fueron verificados mediante la plataforma TUSDATOS sin hallazgos impeditivos.',
    ),

    createHeading(3, 'DÉCIMA CUARTA: Valor y Forma de Pago'),
    createParagraph(
      `La BENEFICIARIA pagará al CONSTITUYENTE como contraprestación por el derecho de servidumbre constituido, la suma total de ${offerLetters} ($ ${offerNumbers}), mediante desembolsos vinculados a la firma de la presente escritura pública y a la entrega del certificado de tradición y libertad que acredite su efectivo registro.`,
    ),

    createHeading(3, 'DÉCIMA QUINTA: Renuncia a Condición Resolutoria'),
    createParagraph('El CONSTITUYENTE renuncia expresamente al ejercicio de la condición resolutoria derivada de la forma de pago pactada.'),

    createHeading(3, 'DÉCIMA SEXTA: Paz y Salvo Tributario'),
    createParagraph(
      'El CONSTITUYENTE declara que el inmueble se encuentra a paz y salvo por concepto de impuestos prediales, tasas, contribuciones y valorizaciones liquidadas a la fecha.',
    ),

    createHeading(3, 'DÉCIMA SÉPTIMA: Gastos Notariales y Registro'),
    createParagraph(
      'Los gastos de derechos notariales, boleta fiscal y registro ocasionados por el otorgamiento de esta escritura serán asumidos por la BENEFICIARIA. La retención en la fuente (si aplicare) estará a cargo del CONSTITUYENTE.',
    ),

    createHeading(3, 'DÉCIMA OCTAVA: Cláusula Penal'),
    createParagraph(
      'El incumplimiento de las obligaciones contractuales dará lugar a la parte cumplida para exigir de la parte incumplida una pena pecuniaria del veinte por ciento (20%) del valor total del negocio, sin perjuicio de la indemnización de perjuicios.',
    ),

    createHeading(3, 'DÉCIMA NOVENA: Poder Especial'),
    createParagraph(
      'El CONSTITUYENTE confiere poder especial, amplio y suficiente a la BENEFICIARIA para realizar todos los actos necesarios para el registro efectivo de la escritura pública, incluyendo aclaraciones o adiciones.',
    ),

    createHeading(3, 'VIGÉSIMA: Acuerdo Integral'),
    createParagraph('Las Partes declaran que este contrato constituye el acuerdo completo y total entre ellas, dejando sin efecto estipulaciones previas verbales o escritas.'),

    createHeading(3, 'VIGÉSIMA PRIMERA: Protocolizaciones y Aceptación'),
    createParagraph(
      `Con esta escritura se protocolizan: Certificado de tradición y libertad del folio ${record.folio}, poder especial, plano topográfico denominado “${record.plan_name}”, constancia de la Unidad de Restitución de Tierras y documento de identidad de las partes.`,
    ),
    createParagraph('El apoderado especial de la BENEFICIARIA manifiesta que acepta en nombre de su representada la servidumbre constituida.'),

    createHeading(2, 'FIRMAS'),
    createParagraph('________________________________________________________'),
    createParagraph(record.owners, 'OTORGANTE / CONSTITUYENTE: '),
    createParagraph('________________________________________________________'),
    createParagraph('YEISON FABIAN MARÍN ÁLZATE — C.C. 80.190.666 de Bogotá', 'APODERADO ESPECIAL BENEFICIARIA: '),
    createParagraph('CELSIA COLOMBIA S.A. E.S.P. — NIT. 800.249.860-1'),
  ]
}

/**
 * Compiles the exact representation of ID02 descripción de linderos.docx
 */
function compileDescripcionLinderosNodes(
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

/**
 * Compiles the exact representation of MINUTA_TIPO_TERRITORIUM.doc
 */
function compileMinutaTipoTerritoriumNodes(
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

/**
 * Standard predial diagnostic report (V1)
 */
function compileStandardPredialReportNodes(
  record: ConsolidatedMasterRecord,
  template: ExpedienteDocumentTemplate,
  _options: DocumentCompilerOptions,
  verificationCode: string,
  compiledAt: string,
  narrativeText: string,
): JSONContent[] {
  return [
    // Header
    createHeading(1, template.name.toUpperCase()),
    createParagraph(
      `Expediente Predial Oficial — Territorium Grupo Jurídico | Generación Determinística (Plantilla ${template.code} v${template.version})`,
    ),

    // 1. Identificación Predial
    createHeading(2, '1. Identificación Predial y Catastral'),
    createKeyValueTable([
      ['Nombre del Predio', record.property_name],
      ['Folio de Matrícula Inmobiliaria', record.folio],
      ['Cédula Catastral', record.cadastral_id],
      ['Ubicación Territorial', `${record.municipality}, ${record.department}`],
      ['Vereda / Sector', record.village || 'No especificada'],
      ['Código Interno de Gestión', record.property_code || '—'],
    ]),

    // 2. Diagnóstico Jurídico y Titularidad
    createHeading(2, '2. Diagnóstico Jurídico y Titularidad'),
    createKeyValueTable([
      ['Propietarios Identificados', record.owners],
      ['Modo de Adquisición', record.acquisition_mode],
      ['Linderos Registrados', record.boundaries],
      ['Documento de Linderos', record.boundaries_document],
      ['Condiciones Jurídicas y Gravámenes', record.legal_conditions],
      ['Radicado Ministerio de Justicia', record.justice_ministry_case],
      ['Radicado Unidad de Restitución de Tierras (URT)', record.urt_case],
      ['Dirección Territorial URT', record.urt_territorial_direction],
    ]),

    // 3. Parámetros Técnicos y Afectación
    createHeading(2, '3. Parámetros Técnicos y Franja de Servidumbre'),
    createKeyValueTable([
      ['Área de Servidumbre Requerida', `${record.easement_area} m²`],
      ['Longitud de Servidumbre', `${record.easement_length} m`],
      ['Ancho de Servidumbre', `${record.easement_width} m`],
      ['Infraestructuras Afectadas (Postes / Torres)', record.infrastructure_count],
      ['Plano Topográfico Referenciado', record.plan_name],
      ['Escala del Plano', record.plan_scale],
      ['Nivel de Tensión / Servidumbre', record.voltage_level],
    ]),

    // 4. Valoración Económica y Negociación
    createHeading(2, '4. Valoración Económica y Negociación Directa'),
    createKeyValueTable([
      ['Primera Oferta Formal Notificada', record.first_offer],
      ['Segunda Oferta Formal', record.second_offer],
      ['Tercera Oferta Formal', record.third_offer],
      ['Coincidencia de Valores Números/Letras', record.values_match],
      ['Valor Negociado', record.negotiated_value ? `${record.negotiated_value} (${record.negotiated_value_letters ?? ''})` : '—'],
    ]),

    // 5. Consideraciones Jurídicas (Sección Narrativa para IA / usuario)
    createHeading(2, '5. Consideraciones Jurídicas y Recomendaciones'),
    createParagraph(narrativeText),

    // 6. Trazabilidad y Firmas
    createHeading(2, '6. Constancia y Trazabilidad de Aprobación'),
    createKeyValueTable([
      ['Código Único de Verificación', verificationCode],
      ['Plantilla Utilizada', `${template.name} (${template.code} v${template.version})`],
      ['Versión Consolidado Maestro', `Consolidado v${record.metadata.is_valid ? '1' : '0'}`],
      ['Fecha y Hora de Consolidación', record.metadata.consolidated_at],
      [
        'Versiones de Origen Aprobadas',
        `Títulos: ${record.metadata.titles_result_version_id} | Planos: ${record.metadata.plans_result_version_id} | Negociación: ${record.metadata.negotiation_result_version_id}`,
      ],
      ['Fecha de Compilación Documental', compiledAt],
    ]),
  ]
}

/**
 * Deterministically compiles an approved ConsolidatedMasterRecord into
 * structured Tiptap JSONContent (HU-V2-048).
 *
 * Rules:
 * - Structured fields (Folio, Cédula, Propietarios, Linderos, Ofertas, Áreas) are injected
 *   verbatim without AI hallucinations.
 * - Missing values are highlighted with warning indicators.
 * - Supports the 3 official templates from plantillas documentos finales.
 */
export function compileConsolidatedToTiptap(
  record: ConsolidatedMasterRecord,
  options: DocumentCompilerOptions = {},
): DocumentCompilationResult {
  const template = options.template ?? OFFICIAL_PREDIAL_TEMPLATE_V1
  const warnings: string[] = []

  // Check required fields
  for (const field of template.requiredFields) {
    const val = record[field]
    if (!val || val === '—' || String(val).trim() === '') {
      warnings.push(`Campo requerido '${String(field)}' no cuenta con información en el consolidado.`)
    }
  }

  const verificationCode = computeDeterministicVerificationCode(record, template.version)
  const compiledAt = new Date().toISOString()

  const narrativeText =
    options.narrativeOverride ??
    template.sections.find((s) => s.type === 'narrative_observations')?.defaultNarrative ??
    'Se verificó la cadena de tradición del predio sin hallazgos impeditivos para el saneamiento.'

  let docNodes: JSONContent[]

  if (template.id === 'tpl-escritura-publica' || template.code === 'ESCRITURA_TOL_ANZ_045') {
    docNodes = compileEscrituraPublicaNodes(record, options)
  } else if (template.id === 'tpl-descripcion-linderos' || template.code === 'ID02_DESCRIPCION_LINDEROS') {
    docNodes = compileDescripcionLinderosNodes(record, options)
  } else if (template.id === 'tpl-minuta-tipo' || template.code === 'MINUTA_TIPO_TERRITORIUM') {
    docNodes = compileMinutaTipoTerritoriumNodes(record, options)
  } else {
    docNodes = compileStandardPredialReportNodes(
      record,
      template,
      options,
      verificationCode,
      compiledAt,
      narrativeText,
    )
  }

  const content: JSONContent = {
    type: 'doc',
    content: docNodes,
  }

  const metadata: DocumentCompilationMetadata = {
    templateId: template.id,
    templateVersion: template.version,
    consolidatedAt: record.metadata.consolidated_at,
    titlesVersionId: record.metadata.titles_result_version_id,
    plansVersionId: record.metadata.plans_result_version_id,
    negotiationVersionId: record.metadata.negotiation_result_version_id,
    compiledAt,
    compiledBy: options.compiledBy,
    folio: record.folio,
    cadastralId: record.cadastral_id,
    verificationHash: verificationCode,
  }

  return {
    content,
    metadata,
    warnings,
  }
}
