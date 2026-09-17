import React, { useState } from 'react'
import {
  Shield,
  Key,
  Bell,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Send,
  Save,
  Check
} from 'lucide-react'
import { evaluateServiceCapacity } from '../lib/corporateNotificationDispatcherP2'
import type { SsoConfiguration, NotificationChannelConfig } from '../types'

export const SsoAndNotificationSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sso' | 'signature' | 'notifications' | 'capacity'>('sso')

  // Estado SSO (US-010)
  const [ssoConfig, setSsoConfig] = useState<SsoConfiguration>({
    id: 'sso-current',
    providerName: 'azure_ad',
    entityId: 'https://sts.windows.net/territorium-tenant/',
    clientId: 'client-territorium-app',
    issuer: 'https://login.microsoftonline.com/territorium-tenant/v2.0',
    defaultRole: 'CONSULTOR',
    roleClaimMapping: {
      'ISA-Admins': 'ADMIN',
      'ISA-Revisores': 'REVISOR',
      'ISA-Operadores': 'OPERADOR'
    },
    isActive: true
  })

  // Estado Canales (US-136)
  const [teamsWebhook, setTeamsWebhook] = useState('https://outlook.office.com/webhook/territorium-critical')
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/territorium/alerts')
  const [channelsSaved, setChannelsSaved] = useState(false)

  // Métricas de Capacidad (US-145)
  const capacityMetrics = [
    evaluateServiceCapacity('openai', 68000, 100000, 'tokens'),
    evaluateServiceCapacity('gemini', 82000, 100000, 'tokens'),
    evaluateServiceCapacity('supabase_storage', 420, 1000, 'megabytes'),
    evaluateServiceCapacity('worker_pool', 88, 100, 'active_jobs')
  ]

  const handleSaveChannels = () => {
    setChannelsSaved(true)
    setTimeout(() => setChannelsSaved(false), 2500)
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden my-6">
      {/* Cabecera de Pestañas */}
      <div className="border-b border-slate-200 bg-slate-50 p-2 flex items-center space-x-1.5 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('sso')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'sso' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Key size={15} className="text-blue-600" />
          <span>SSO Corporativo (US-010)</span>
        </button>

        <button
          onClick={() => setActiveTab('signature')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'signature' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield size={15} className="text-emerald-600" />
          <span>Firma Electrónica (US-115)</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'notifications' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bell size={15} className="text-amber-600" />
          <span>Canales Corporativos (US-136)</span>
        </button>

        <button
          onClick={() => setActiveTab('capacity')}
          className={`px-3.5 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'capacity' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity size={15} className="text-purple-600" />
          <span>Capacidad y Cuotas (US-145)</span>
        </button>
      </div>

      {/* Contenido según Pestaña */}
      <div className="p-5">
        {activeTab === 'sso' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h4 className="font-semibold text-slate-800 text-sm">Proveedor de Identidad Corporativa (SSO SAML / OIDC)</h4>
                <p className="text-slate-500">Permite autenticación unificada con Azure Active Directory, Okta o Google Workspace</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold">
                {ssoConfig.isActive ? 'Activo y Federado' : 'Inactivo'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Proveedor Federado</label>
                <select
                  value={ssoConfig.providerName}
                  onChange={e => setSsoConfig({ ...ssoConfig, providerName: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="azure_ad">Microsoft Azure Active Directory (Entra ID)</option>
                  <option value="okta">Okta Identity Cloud</option>
                  <option value="google_workspace">Google Workspace</option>
                  <option value="saml2">SAML 2.0 Estándar</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Client ID / App ID</label>
                <input
                  type="text"
                  value={ssoConfig.clientId}
                  onChange={e => setSsoConfig({ ...ssoConfig, clientId: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">Issuer / Autoridad OpenID Connect</label>
                <input
                  type="text"
                  value={ssoConfig.issuer}
                  onChange={e => setSsoConfig({ ...ssoConfig, issuer: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'signature' && (
          <div className="space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-200">
              <h4 className="font-semibold text-slate-800 text-sm">Firma Electrónica Certificada y Estampa de Tiempo (RFC 3161)</h4>
              <p className="text-slate-500">Validez jurídica para actas de acuerdo voluntario y ofertas económicas formales</p>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start space-x-3">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-emerald-900 block">Sello Criptográfico Activo</span>
                <span className="text-emerald-800 text-xs">
                  Todo documento generado es firmado con hash SHA-256 inmutable y sellado de tiempo cronológico acreditado por Certicámara / TSA corporativa.
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-200">
              <h4 className="font-semibold text-slate-800 text-sm">Despachador de Alertas a Canales Corporativos (US-136)</h4>
              <p className="text-slate-500">Notifique bloqueos de lotes, alertas al 80% de presupuesto y eventos críticos</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Webhook Microsoft Teams (Incoming Webhook)</label>
                <input
                  type="text"
                  value={teamsWebhook}
                  onChange={e => setTeamsWebhook(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Webhook Slack Channel (#predial-alertas)</label>
                <input
                  type="text"
                  value={slackWebhook}
                  onChange={e => setSlackWebhook(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-md font-mono text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveChannels}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 flex items-center space-x-1.5"
                >
                  {channelsSaved ? <Check size={14} className="text-emerald-400" /> : <Save size={14} />}
                  <span>{channelsSaved ? 'Canales Guardados' : 'Guardar Canales de Alerta'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'capacity' && (
          <div className="space-y-4 text-xs">
            <div className="pb-3 border-b border-slate-200">
              <h4 className="font-semibold text-slate-800 text-sm">Monitor de Capacidad y Cuotas Externas (US-145)</h4>
              <p className="text-slate-500">Alertas preventivas de saturación y cuota antes de agotar servicios en producción</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capacityMetrics.map(item => (
                <div key={item.serviceName} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 uppercase tracking-wider">{item.serviceName}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      item.alertLevel === 'normal'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.alertLevel === 'warning_70'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.percentConsumed}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.percentConsumed > 80 ? 'bg-rose-500' : item.percentConsumed > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(item.percentConsumed, 100)}%` }}
                    />
                  </div>

                  <p className="text-slate-600 text-[11px]">{item.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
