import React, { useState } from 'react'
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  Calendar,
  Lock,
  Stamp,
  UserCheck,
  UploadCloud,
  FileCheck,
  Paperclip,
  KeyRound,
  ShieldCheck,
  Eye,
} from 'lucide-react'
import {
  validateNotaryShareToken,
  recordNotaryConcept,
  createOtpChallenge,
  verifyOtpCode,
  registerNotarySupportDocument,
  type NotaryConceptSubmission,
  type NotarySupportDocument,
  type OtpChallenge,
} from '../../lib/publicNotaryPortal'

interface PublicNotaryPortalProps {
  token: string
  propertyFolio?: string
  minuteContent?: string
  boundariesContent?: string
  requireOtp?: boolean
  initialOtpCode?: string // Para pruebas y bypass de testing
  onConceptSubmitted?: (submission: NotaryConceptSubmission) => void
  onDocumentAttached?: (doc: NotarySupportDocument) => void
}

export function PublicNotaryPortal({
  token,
  propertyFolio = 'FMI-001-987654',
  minuteContent = `MINUTA DE COMPRAVENTA Y CONSTITUCIÓN DE SERVIDUMBRE PREDIAL
COMPARECIENTES: GRUPO JURÍDICO TERRITORIUM S.A.S. Y EL PROPIETARIO REGISTRADO.
PRIMERA: EL VENDEDOR TRANSFIERE A FAVOR DE LA EMPRESA EL DERECHO REAL DE SERVIDUMBRE DE TRÁNSITO Y CONDUCCIÓN DE ENERGÍA...`,
  boundariesContent = `NORTE: En longitud de 124.50 metros con predio La Esperanza de Pedro Pérez.
SUR: En longitud de 98.20 metros con camino veredal.
ORIENTE: En longitud de 210.00 metros con quebrada El Chuscal.
OCCIDENTE: En longitud de 195.40 metros con predio San José.`,
  requireOtp = false,
  initialOtpCode,
  onConceptSubmitted,
  onDocumentAttached,
}: PublicNotaryPortalProps) {
  const session = validateNotaryShareToken(token)

  // US-296: Desafío de código OTP de 6 dígitos
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(() =>
    requireOtp && session.isValid && session.payload
      ? createOtpChallenge(session.payload.tokenId, initialOtpCode)
      : null
  )
  const [otpInput, setOtpInput] = useState('')
  const [otpError, setOtpError] = useState('')
  const [isOtpUnlocked, setIsOtpUnlocked] = useState(!requireOtp)

  const [decision, setDecision] = useState<'conforme' | 'ajustes_requeridos'>('conforme')
  const [officialName, setOfficialName] = useState('')
  const [notaryNumber, setNotaryNumber] = useState(session.payload?.recipientOrganization || '')
  const [observations, setObservations] = useState('')
  const [submittedRecord, setSubmittedRecord] = useState<NotaryConceptSubmission | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // US-293: Adjuntos de soporte
  const [attachedDocs, setAttachedDocs] = useState<NotarySupportDocument[]>([])
  const [attachedType, setAttachedType] = useState<'paz_y_salvo' | 'minuta_firmada' | 'concepto_tecnico'>('paz_y_salvo')

  if (!session.isValid) {
    return (
      <div className="public-portal-container error-state">
        <div className="public-portal-card error">
          <AlertTriangle size={48} className="text-danger" />
          <h2>Enlace Notarial No Válido o Expirado</h2>
          <p>
            {session.error === 'token_expirado'
              ? 'Este enlace temporal ha superado su fecha límite de validez.'
              : session.error === 'token_revocado'
              ? 'Este enlace ha sido revocado por el equipo jurídico de Territorium.'
              : 'El enlace proporcionado no es auténtico o está incompleto.'}
          </p>
          <span className="contact-help">Comuníquese con el coordinador de tierras para solicitar un nuevo enlace.</span>
        </div>
      </div>
    )
  }

  const payload = session.payload!

  // US-296: Puerta de verificación OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpChallenge) return

    const res = verifyOtpCode(otpChallenge, otpInput)
    setOtpChallenge(res.updatedChallenge)
    if (res.success) {
      setIsOtpUnlocked(true)
      setOtpError('')
    } else {
      setOtpError(res.error || 'Código incorrecto')
    }
  }

  if (requireOtp && !isOtpUnlocked) {
    return (
      <div className="public-portal-container flex items-center justify-center min-h-[80vh] p-4">
        <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Verificación de Seguridad Notarial (US-296)</h2>
            <p className="text-xs text-slate-400 mt-1">
              Ingrese el código OTP de 6 dígitos enviado para acceder al expediente de <strong>{payload.recipientOrganization}</strong>.
            </p>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
            <div>
              <input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-48 text-center tracking-[0.4em] font-mono text-xl py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            {otpError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {otpError}
              </p>
            )}

            <button
              type="submit"
              disabled={otpInput.length !== 6 || (otpChallenge?.attemptsLeft || 0) <= 0}
              className="w-full py-2 px-4 text-xs font-semibold rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Verificar y Entrar al Portal
            </button>

            {otpChallenge && (
              <p className="text-[10px] text-slate-500 font-mono">
                Intentos restantes: {otpChallenge.attemptsLeft} de 3
              </p>
            )}
          </form>
        </div>
      </div>
    )
  }

  // US-293: Manejo de carga de documento adjunto simulado
  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = registerNotarySupportDocument(session, {
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/pdf',
      documentType: attachedType,
    })

    if (result.success && result.document) {
      setAttachedDocs((prev) => [...prev, result.document!])
      onDocumentAttached?.(result.document!)
    } else {
      setErrorMsg(result.error || 'Error al adjuntar archivo')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const result = recordNotaryConcept(session, {
      decision,
      notaryOfficialName: officialName,
      notaryNumber,
      observations: decision === 'ajustes_requeridos' ? observations : undefined,
      documentHashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    })

    if (!result.success || !result.record) {
      setErrorMsg(result.error || 'Error al radicar el concepto')
      return
    }

    setSubmittedRecord(result.record)
    if (onConceptSubmitted) onConceptSubmitted(result.record)
  }

  const watermarkText = `COPIA INFORMATIVA - ${payload.recipientOrganization.toUpperCase()} - VALIDO HASTA ${new Date(payload.expiresAt).toLocaleDateString()}`

  return (
    <div className="public-notary-portal">
      {/* Barra institucional de la notaría (US-289) */}
      <header className="notary-portal-header">
        <div className="notary-header-content">
          <div className="brand-badge">
            <Building size={20} />
            <span>PORTAL EXTERNO DE VALIDACIÓN NOTARIAL</span>
          </div>
          <div className="recipient-pill">
            <span>Destinatario: {payload.recipientName} ({payload.recipientOrganization})</span>
          </div>
        </div>
        <div className="session-expiry">
          <Calendar size={14} />
          <span>Vigencia: {new Date(payload.expiresAt).toLocaleString()}</span>
        </div>
      </header>

      <main className="notary-portal-body">
        {submittedRecord ? (
          <div className="concept-success-card">
            <CheckCircle2 size={48} className="text-success" />
            <h2>Concepto Notarial Radicado con Éxito</h2>
            <p>
              Se ha registrado formalmente su pronunciamiento como <strong>{submittedRecord.decision === 'conforme' ? 'MINUTA CONFORME' : 'REQUIERE AJUSTES'}</strong>.
            </p>
            <div className="receipt-box">
              <div><strong>Funcionario Notarial:</strong> {submittedRecord.notaryOfficialName}</div>
              <div><strong>Notaría:</strong> {submittedRecord.notaryNumber}</div>
              <div><strong>Fecha y Hora de Radicación:</strong> {new Date(submittedRecord.submittedAt).toLocaleString()}</div>
              <div><strong>Hash Criptográfico SHA-256:</strong> <span className="mono">{submittedRecord.documentHashSha256.substring(0, 24)}...</span></div>
              {attachedDocs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-700">
                  <strong>Documentos Adjuntos ({attachedDocs.length}):</strong>
                  <ul className="list-disc list-inside mt-1 text-xs text-slate-300">
                    {attachedDocs.map((d) => (
                      <li key={d.id}>{d.fileName} ({d.documentType})</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <span className="receipt-note">Territorium ha notificado al equipo legal para proceder con los trámites correspondientes.</span>
          </div>
        ) : (
          <div className="portal-columns-layout">
            {/* Columna Izquierda: Visor con Marca de Agua Disuasoria (US-291, US-294) */}
            <section className="document-reader-panel relative overflow-hidden">
              {/* US-294: Marca de agua diagonal disuasoria */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10 select-none z-10"
              >
                <span className="text-3xl font-black text-slate-100 uppercase tracking-widest rotate-[-30deg] text-center border-4 border-slate-100 p-6 rounded-3xl">
                  {watermarkText}
                </span>
              </div>

              <div className="reader-header">
                <FileText size={18} />
                <h3>Ficha Jurídica y Minuta Predial — Matrícula: {propertyFolio}</h3>
              </div>

              <div className="minute-text-container z-20 relative">
                <div className="minute-section">
                  <h4>Transcripción Perimetral de Linderos</h4>
                  <pre className="boundaries-pre">{boundariesContent}</pre>
                </div>

                <div className="minute-section">
                  <h4>Texto de la Minuta</h4>
                  <div className="minute-body-text">{minuteContent}</div>
                </div>
              </div>

              {/* US-293: Adjuntar documentos de soporte */}
              <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 z-20 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                    Adjuntar Documentos de Soporte (US-293)
                  </span>
                  <select
                    value={attachedType}
                    onChange={(e) => setAttachedType(e.target.value as any)}
                    className="text-[11px] bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-0.5 focus:outline-none"
                  >
                    <option value="paz_y_salvo">Paz y Salvo</option>
                    <option value="minuta_firmada">Minuta Firmada</option>
                    <option value="concepto_tecnico">Concepto Técnico</option>
                  </select>
                </div>

                <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-lg cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-colors text-xs text-slate-300">
                  <UploadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Seleccionar PDF (Paz y salvo o Minuta firmada)</span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleSimulatedFileUpload}
                    className="hidden"
                  />
                </label>

                {attachedDocs.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {attachedDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-1.5 bg-slate-900 rounded border border-slate-800 text-[11px]">
                        <span className="flex items-center gap-1 text-slate-300 truncate">
                          <FileCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                          {doc.fileName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono capitalize">
                          {doc.documentType.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Columna Derecha: Formulario de Conformidad Notarial (US-292) */}
            <aside className="decision-form-panel">
              <div className="decision-header">
                <Stamp size={18} />
                <h3>Pronunciamiento Oficial de Notaría</h3>
              </div>

              {errorMsg && (
                <div className="error-alert">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="notary-form">
                <div className="form-group">
                  <label>Decisión sobre la Minuta</label>
                  <div className="decision-options">
                    <label className={`decision-radio-card ${decision === 'conforme' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="decision"
                        value="conforme"
                        checked={decision === 'conforme'}
                        onChange={() => setDecision('conforme')}
                      />
                      <div className="radio-text">
                        <strong>Minuta Conforme</strong>
                        <span>Los linderos y cláusulas cumplen los requisitos para otorgar escritura.</span>
                      </div>
                    </label>

                    <label className={`decision-radio-card ${decision === 'ajustes_requeridos' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="decision"
                        value="ajustes_requeridos"
                        checked={decision === 'ajustes_requeridos'}
                        onChange={() => setDecision('ajustes_requeridos')}
                      />
                      <div className="radio-text">
                        <strong>Requiere Ajustes</strong>
                        <span>Existen discrepancias en linderos, nombres o gravámenes a subsanar.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="officialName">Nombre del Notario o Funcionario Responsable</label>
                  <input
                    id="officialName"
                    type="text"
                    required
                    placeholder="Ej. Dr. Mario Gómez Rincón"
                    value={officialName}
                    onChange={(e) => setOfficialName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="notaryNumber">Despacho Notarial</label>
                  <input
                    id="notaryNumber"
                    type="text"
                    required
                    placeholder="Ej. Notaría 45 del Círculo de Bogotá"
                    value={notaryNumber}
                    onChange={(e) => setNotaryNumber(e.target.value)}
                  />
                </div>

                {decision === 'ajustes_requeridos' && (
                  <div className="form-group">
                    <label htmlFor="observations">Observaciones Detalladas para el Equipo Legal</label>
                    <textarea
                      id="observations"
                      rows={4}
                      required
                      placeholder="Describa los cambios requeridos en linderos, cláusulas o documentos adicionales..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-submit-concept">
                    <Send size={16} /> Radicar Concepto Notarial
                  </button>
                </div>
              </form>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
