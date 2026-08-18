import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@gpu/ui";
import { apiClient } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { useApi } from "../hooks/useApi.js";
import { AsyncSection } from "../components/AsyncSection.js";
import { PageHeader } from "../components/PageHeader.js";
import { deriveNotifications } from "../lib/notifications.js";
import type { DerivedNotification } from "../lib/notifications.js";
import { loadReadIds, saveReadIds } from "../lib/notificationReadState.js";
import { formatDateTime, relativeDayLabel } from "../lib/format.js";

function groupByDay(notifications: DerivedNotification[]): { label: string; items: DerivedNotification[] }[] {
  const groups: { label: string; items: DerivedNotification[] }[] = [];
  for (const notification of notifications) {
    const label = relativeDayLabel(notification.occurredAt);
    const existing = groups.at(-1);
    if (existing && existing.label === label) {
      existing.items.push(notification);
    } else {
      groups.push({ label, items: [notification] });
    }
  }
  return groups;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const reservations = useApi(() => apiClient.reservations.listMine({ pageSize: 100 }), []);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) setReadIds(loadReadIds(user.id));
  }, [user]);

  const notifications = useMemo(
    () => deriveNotifications(reservations.data?.items ?? []),
    [reservations.data],
  );
  const groups = useMemo(() => groupByDay(notifications), [notifications]);
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  function markRead(id: string) {
    if (!user) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(user.id, next);
      return next;
    });
  }

  function markAllRead() {
    if (!user) return;
    const next = new Set(notifications.map((n) => n.id));
    setReadIds(next);
    saveReadIds(user.id, next);
  }

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
        actions={
          <Button variant="secondary" onClick={markAllRead} disabled={unreadCount === 0}>
            Mark all as read
          </Button>
        }
      />

      <AsyncSection
        loading={reservations.loading}
        error={reservations.error}
        onRetry={reservations.reload}
        isEmpty={notifications.length === 0}
        emptyState={
          <EmptyState
            title="No notifications yet"
            description="You'll see updates here once faculty act on your reservations, or your sessions start and finish."
          />
        }
        skeleton={
          <Card>
            <Skeleton height="3rem" />
            <Skeleton height="3rem" />
            <Skeleton height="3rem" />
          </Card>
        }
      >
        {groups.map((group) => (
          <section key={group.label} className="notification-group">
            <h2 className="notification-group__label">{group.label}</h2>
            <ul className="stacked-list">
              {group.items.map((notification) => {
                const isRead = readIds.has(notification.id);
                return (
                  <li key={notification.id} className={isRead ? "" : "notification--unread"}>
                    <div>
                      <p className="stacked-list__title">
                        {!isRead && (
                          <span className="unread-dot" aria-hidden="true">
                            ●
                          </span>
                        )}
                        {notification.title}
                      </p>
                      <p className="stacked-list__meta">{notification.message}</p>
                      <p className="stacked-list__meta">{formatDateTime(notification.occurredAt)}</p>
                    </div>
                    <div className="reservation-row__actions">
                      <Badge tone={notification.tone}>{isRead ? "Read" : "Unread"}</Badge>
                      {!isRead && (
                        <Button variant="secondary" onClick={() => markRead(notification.id)}>
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </AsyncSection>
    </div>
  );
}
