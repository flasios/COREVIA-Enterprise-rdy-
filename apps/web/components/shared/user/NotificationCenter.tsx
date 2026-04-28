import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, X, Check, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";
import { getNotificationActionUrl, isDemandNotification } from "@/shared/lib/notification-routing";

export default function NotificationCenter() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch all notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications?limit=50");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const result = await response.json();
      return result.data as Notification[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const notifications = notificationsData || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getNotificationActionLabel = (notification: Notification): string => {
    if (isDemandNotification(notification)) {
      return t('notifications.reviewRequestStatus');
    }
    return t('notifications.open');
  };

  // Mark single notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({
        title: t('notifications.error'),
        description: t('notifications.failedMarkRead'),
        variant: "destructive",
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: t('notifications.success'),
        description: t('notifications.allMarkedRead'),
      });
    },
    onError: () => {
      toast({
        title: t('notifications.error'),
        description: t('notifications.failedMarkAllRead'),
        variant: "destructive",
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("DELETE", `/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: t('notifications.success'),
        description: t('notifications.deleted'),
      });
    },
    onError: () => {
      toast({
        title: t('notifications.error'),
        description: t('notifications.failedDelete'),
        variant: "destructive",
      });
    },
  });

  const handleGoToSection = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    const actionUrl = getNotificationActionUrl(notification);
    if (actionUrl) {
      if (!notification.isRead) {
        markAsReadMutation.mutate(notification.id);
      }
      setOpen(false);
      setLocation(actionUrl);
    }
  };

  const handleMarkAsRead = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    markAsReadMutation.mutate(notificationId);
  };

  const handleDeleteNotification = (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation();
    deleteNotificationMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      markAllAsReadMutation.mutate();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 px-1 text-xs"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        data-testid="popover-notifications"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-base" data-testid="text-notifications-title">
            {t('notifications.title')}
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <Check className="h-4 w-4 mr-1" />
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground" data-testid="text-loading">
              {t('notifications.loading')}
            </div>
          )}
          {!isLoading && notifications.length === 0 && (
            <div className="p-8 text-center" data-testid="empty-state-notifications">
              <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground font-medium">
                {t('notifications.noNotifications')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('notifications.allCaughtUp')}
              </p>
            </div>
          )}
          {!isLoading && notifications.length > 0 && (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 relative ${
                    notification.isRead ? "" : "bg-accent/30"
                  }`}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!notification.isRead && (
                          <div
                            className="h-2 w-2 rounded-full bg-primary flex-shrink-0"
                            data-testid={`indicator-unread-${notification.id}`}
                          />
                        )}
                        <h4
                          className={`text-sm font-medium ${
                            notification.isRead ? "text-muted-foreground" : "text-foreground"
                          }`}
                          data-testid={`text-notification-title-${notification.id}`}
                        >
                          {notification.title}
                        </h4>
                      </div>
                      <p
                        className="text-sm text-muted-foreground mb-2"
                        data-testid={`text-notification-message-${notification.id}`}
                      >
                        {notification.message}
                      </p>
                      <p
                        className="text-xs text-muted-foreground mb-3"
                        data-testid={`text-notification-time-${notification.id}`}
                      >
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                      
                      {notification.type && (
                        <Badge
                          variant="outline"
                          className="mb-3 text-xs"
                          data-testid={`badge-notification-type-${notification.id}`}
                        >
                          {notification.type.replaceAll("_", " ")}
                        </Badge>
                      )}
                      
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Boolean(getNotificationActionUrl(notification)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                            onClick={(e) => handleGoToSection(e, notification)}
                            data-testid={`button-view-${notification.id}`}
                          >
                            <ChevronRight className="h-3 w-3 mr-1" />
                            {getNotificationActionLabel(notification)}
                          </Button>
                        )}
                        {!notification.isRead && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={(e) => handleMarkAsRead(e, notification.id)}
                            disabled={markAsReadMutation.isPending}
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {t('notifications.read')}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                          disabled={deleteNotificationMutation.isPending}
                          data-testid={`button-delete-notification-${notification.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
