import type { JSONContent } from '@tiptap/react'
import type { ConsolidatedMasterRecord } from '../expedienteConsolidation'
import { createParagraph, createHeading, createKeyValueTable, normalizeConsolidatedRecord } from './nodes'
import type { DocumentCompilerOptions } from './types'

/**
 * Compiles the exact representation of ESCRITURA TOL-ANZ-045.docx
 */
export function compileEscrituraPublicaNodes(
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
