import { describe, it, expect } from 'vitest'
import {
  formatCorporateNotificationPayload,
  evaluateServiceCapacity
} from './corporateNotificationDispatcherP2'
import type { CorporateNotificationPayload, NotificationChannelConfig } from '../types'

describe('corporateNotificationDispatcherP2 (US-136, US-145)', () => {
  const mockPayload: CorporateNotificationPayload = {
    projectId: 'proj-isa-500kv',
    eventType: 'budget_alert',
    title: 'Alerta de Presupuesto Consumido',
    message: 'El lote L-01 ha alcanzado el 85% del presupuesto asignado.',
    urgency: 'high',
    metadata: {
      lote: 'L-01',
      gasto_actual_usd: 85.0,
      tope_usd: 100.0
    },
    timestamp: '2026-09-17T12:00:00Z'
  }

  describe('US-136: Formateo y Despacho a Canales Corporativos', () => {
    it('formatea correctamente mensajes tipo Microsoft Teams MessageCard', () => {
      const teamsConfig: NotificationChannelConfig = {
        id: 'c-teams',
        channelType: 'teams',
        webhookUrl: 'https://outlook.office.com/webhook/test',
        targetRecipients: [],
        eventsSubscribed: ['budget_alert', 'batch_blocked'],
        isEnabled: true
      }

      const dispatch = formatCorporateNotificationPayload(mockPayload, teamsConfig)
      expect(dispatch.canDispatch).toBe(true)
      expect(dispatch.formattedBody['@type']).toBe('MessageCard')
      expect(dispatch.formattedBody['summary']).toBe(mockPayload.title)
    })

    it('bloquea el despacho si el canal está deshabilitado o no está suscrito al evento', () => {
      const disabledConfig: NotificationChannelConfig = {
        id: 'c-disabled',
        channelType: 'slack',
        webhookUrl: 'https://hooks.slack.com/services/xxx',
        targetRecipients: [],
        eventsSubscribed: ['budget_alert'],
        isEnabled: false
      }

      const resDisabled = formatCorporateNotificationPayload(mockPayload, disabledConfig)
      expect(resDisabled.canDispatch).toBe(false)
      expect(resDisabled.reason).toContain('deshabilitado')

      const unsubscribedConfig: NotificationChannelConfig = {
        ...disabledConfig,
        isEnabled: true,
        eventsSubscribed: ['batch_blocked'] // No suscrito a budget_alert
      }

      const resUnsub = formatCorporateNotificationPayload(mockPayload, unsubscribedConfig)
      expect(resUnsub.canDispatch).toBe(false)
      expect(resUnsub.reason).toContain('no está suscrito')
    })
  })

  describe('US-145: Monitoreo Preventivo de Capacidad y Cuotas Externas', () => {
    it('identifica estado normal cuando el consumo es bajo (<70%)', () => {
      const status = evaluateServiceCapacity('openai', 35000, 100000, 'tokens')
      expect(status.alertLevel).toBe('normal')
      expect(status.percentConsumed).toBe(35)
    })

    it('emite warning_70 al alcanzar o superar el 70% de cuota', () => {
      const status = evaluateServiceCapacity('gemini', 72000, 100000, 'tokens')
      expect(status.alertLevel).toBe('warning_70')
      expect(status.recommendation).toContain('ADVERTENCIA')
    })

    it('emite critical_85 al superar el 85% de capacidad', () => {
      const status = evaluateServiceCapacity('supabase_storage', 880, 1000, 'megabytes')
      expect(status.alertLevel).toBe('critical_85')
      expect(status.recommendation).toContain('ALERTA ALTA')
    })

    it('emite exhausted_95 y recomienda bloqueo al sobrepasar el 95% de cuota', () => {
      const status = evaluateServiceCapacity('worker_pool', 96, 100, 'active_jobs')
      expect(status.alertLevel).toBe('exhausted_95')
      expect(status.recommendation).toContain('CRÍTICO')
      expect(status.recommendation).toContain('Bloquear')
    })
  })
})
