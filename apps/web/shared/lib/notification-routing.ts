type NotificationLike = {
  reportId?: string | null;
  sectionName?: string | null;
  metadata?: unknown;
  actionUrl?: string | null;
  action_url?: string | null;
  relatedId?: string | null;
  related_id?: string | null;
  relatedType?: string | null;
  related_type?: string | null;
};

function metadataRecord(notification: NotificationLike): Record<string, unknown> | null {
  return notification.metadata && typeof notification.metadata === "object"
    ? notification.metadata as Record<string, unknown>
    : null;
}

export function normalizeNotificationActionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const demandReportMatch = url.match(/^\/demand-reports\/([^/?#]+)(.*)?$/);
  if (!demandReportMatch) return url;

  const reportId = demandReportMatch[1];
  const suffix = demandReportMatch[2] || "";
  if (suffix.includes("tab=") || suffix.includes("section=")) {
    return `/demand-analysis/${reportId}${suffix}`;
  }
  return `/demand-submitted/${reportId}`;
}

export function getNotificationActionUrl(notification: NotificationLike): string | null {
  const metadata = metadataRecord(notification);
  const metadataActionUrl = typeof metadata?.actionUrl === "string" ? metadata.actionUrl : null;
  const metadataLink = typeof metadata?.link === "string" ? metadata.link : null;
  const directActionUrl = typeof notification.actionUrl === "string" ? notification.actionUrl : null;
  const snakeActionUrl = typeof notification.action_url === "string" ? notification.action_url : null;
  const actionUrl = normalizeNotificationActionUrl(directActionUrl || snakeActionUrl || metadataActionUrl || metadataLink);
  if (actionUrl) return actionUrl;

  const relatedType = notification.relatedType || notification.related_type;
  const relatedId = notification.relatedId || notification.related_id;
  const reportId = notification.reportId || (relatedType === "demand_report" ? relatedId : null);

  if (reportId && notification.sectionName) {
    return `/demand-analysis/${reportId}?tab=detailed-requirements&section=${notification.sectionName}`;
  }
  if (reportId) {
    return `/demand-submitted/${reportId}`;
  }
  return null;
}

export function isDemandNotification(notification: NotificationLike): boolean {
  const actionUrl = getNotificationActionUrl(notification);
  return Boolean(notification.reportId || actionUrl?.startsWith("/demand-submitted/") || actionUrl?.startsWith("/demand-analysis/"));
}
