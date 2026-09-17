import type {
  CorporateNotificationPayload,
  NotificationChannelConfig,
  CapacityQuotaStatus,
  CapacityAlertLevel
} from '../types'

/**
 * US-136: Formatea y prepara el payload según el canal corporativo de destino (Teams, Slack, Email, WhatsApp).
 */
export function formatCorporateNotificationPayload(
  payload: CorporateNotificationPayload,
  channelConfig: NotificationChannelConfig
): {
  canDispatch: boolean
  formattedBody: Record<string, unknown>
  reason?: string
} {
  if (!channelConfig.isEnabled) {
    return {
      canDispatch: false,
      formattedBody: {},
      reason: 'El canal de notificación está deshabilitado.'
    }
  }

  if (!channelConfig.eventsSubscribed.includes(payload.eventType)) {
    return {
      canDispatch: false,
      formattedBody: {},
      reason: `El canal no está suscrito al evento '${payload.eventType}'.`
    }
  }

  let formattedBody: Record<string, unknown> = {}

  switch (channelConfig.channelType) {
    case 'teams':
      // Formato Microsoft Teams Adaptive Card / MessageCard
      formattedBody = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: payload.urgency === 'critical' ? 'D9381E' : '0076D7',
        summary: payload.title,
        sections: [
          {
            activityTitle: `[Territorium] ${payload.title}`,
            activitySubtitle: `Proyecto: ${payload.projectId} | Urgencia: ${payload.urgency.toUpperCase()}`,
            text: payload.message,
            facts: Object.entries(payload.metadata || {}).map(([k, v]) => ({
              name: k,
              value: String(v)
            }))
          }
        ]
      }
      break

    case 'slack':
      // Formato Slack Block Kit
      formattedBody = {
        text: `*${payload.title}*\n${payload.message}`,
        attachments: [
          {
            color: payload.urgency === 'critical' ? '#danger' : '#good',
            fields: [
              { title: 'Urgencia', value: payload.urgency, short: true },
              { title: 'Fecha', value: payload.timestamp, short: true }
            ]
          }
        ]
      }
      break

    case 'email_smtp':
      formattedBody = {
        to: channelConfig.targetRecipients,
        subject: `[ALERTA TERRITORIUM] ${payload.title}`,
        html: `<h2>${payload.title}</h2><p>${payload.message}</p><p><strong>Nivel:</strong> ${payload.urgency}</p>`
      }
      break

    case 'whatsapp':
      formattedBody = {
        messaging_product: 'whatsapp',
        recipients: channelConfig.targetRecipients,
        template_name: 'territorium_critical_alert',
        parameters: [payload.title, payload.message, payload.urgency]
      }
      break
  }

  return {
    canDispatch: true,
    formattedBody
  }
}

/**
 * US-145: Evalúa el estado de capacidad de cuotas externas y emite alertas antes de agotar los servicios.
 */
export function evaluateServiceCapacity(
  serviceName: 'openai' | 'gemini' | 'supabase_storage' | 'worker_pool',
  currentUsage: number,
  capacityLimit: number,
  unit: 'tokens' | 'megabytes' | 'active_jobs' | 'usd'
): CapacityQuotaStatus {
  const percentConsumed = capacityLimit > 0
    ? Math.round((currentUsage / capacityLimit) * 10000) / 100
    : 0

  let alertLevel: CapacityAlertLevel = 'normal'
  let recommendation = 'Capacidad operativa normal.'

  if (percentConsumed >= 95) {
    alertLevel = 'exhausted_95'
    recommendation = `CRÍTICO: El servicio '${serviceName}' ha consumido el ${percentConsumed}% de su cuota. Bloquear nuevas cargas no prioritarias.`
  } else if (percentConsumed >= 85) {
    alertLevel = 'critical_85'
    recommendation = `ALERTA ALTA: Capacidad al ${percentConsumed}%. Solicitar ampliación de cuota o liberar espacio.`
  } else if (percentConsumed >= 70) {
    alertLevel = 'warning_70'
    recommendation = `ADVERTENCIA: Capacidad al ${percentConsumed}%. Monitorear consumo del lote en curso.`
  }

  return {
    serviceName,
    currentUsage,
    capacityLimit,
    unit,
    percentConsumed,
    alertLevel,
    recommendation
  }
}
