import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Eye, Edit3, Users, Clock } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from "date-fns";

interface VersionPresenceInfo {
  userId: string;
  displayName: string;
  role?: string;
  activityType: "viewing" | "editing";
  startedAt: Date;
  lastHeartbeat: Date;
}

interface VersionCollaborationIndicatorProps {
  versionId: string;
  reportId: string;
  className?: string;
  compact?: boolean;
  variant?: "default" | "sidebar";
}

interface VersionPresenceUpdatePayload {
  versionId: string;
  viewers?: VersionPresenceInfo[];
  editors?: VersionPresenceInfo[];
}

export function VersionCollaborationIndicator({ 
  versionId, 
   
  reportId: _reportId, 
  className = "",
  compact = false,
  variant = "default"
}: VersionCollaborationIndicatorProps) {
  const { subscribe, isConnected } = useWebSocket();
  const { t } = useTranslation();
  const [viewers, setViewers] = useState<VersionPresenceInfo[]>([]);
  const [editors, setEditors] = useState<VersionPresenceInfo[]>([]);

  useEffect(() => {
    if (!isConnected || !versionId) return;

    // Subscribe to version presence updates
    const unsubscribe = subscribe<VersionPresenceUpdatePayload>("version:presence:update", (payload) => {
      if (payload.versionId === versionId) {
        setViewers(payload.viewers || []);
        setEditors(payload.editors || []);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [versionId, isConnected, subscribe]);

  // Get user initials for avatar
  const getInitials = (displayName: string) => {
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Get role badge color
  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "director":
      case "manager":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700";
      case "specialist":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700";
      case "analyst":
        return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const currentEditor = editors.length > 0 ? editors[0] : null;
  const totalActive = viewers.length + editors.length;

  if (totalActive === 0 && !compact && variant !== "sidebar") {
    return null;
  }

  // Sidebar variant - compact but shows individual users
  if (variant === "sidebar") {
    return (
      <div className={`space-y-2 ${className}`} data-testid="version-collaboration-indicator-sidebar">
        {/* Current Editor */}
        {currentEditor && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
              <Edit3 className="h-3 w-3" />
              <span>{t('versioning.collaborationIndicator.editing')}</span>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 p-2 rounded-md bg-orange-500/5 border border-orange-200 dark:border-orange-800 hover-elevate cursor-pointer">
                    <Avatar className="h-6 w-6 border border-orange-400">
                      <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xs font-semibold">
                        {getInitials(currentEditor.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{currentEditor.displayName}</div>
                      {currentEditor.role && (
                        <div className="text-xs text-muted-foreground capitalize truncate">{currentEditor.role}</div>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="space-y-1">
                    <div className="font-semibold">{currentEditor.displayName}</div>
                    {currentEditor.role && (
                      <div className="text-xs text-muted-foreground capitalize">{currentEditor.role}</div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {t('versioning.collaborationIndicator.started', { time: formatDistanceToNow(new Date(currentEditor.startedAt), { addSuffix: true }) })}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Viewers */}
        {viewers.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Eye className="h-3 w-3" />
              <span>{t('versioning.collaborationIndicator.viewingCount', { count: viewers.length })}</span>
            </div>
            <div className="space-y-1">
              {viewers.map((viewer) => (
                <TooltipProvider key={viewer.userId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 p-2 rounded-md bg-blue-500/5 border border-blue-200 dark:border-blue-800 hover-elevate cursor-pointer">
                        <Avatar className="h-6 w-6 border border-blue-400">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold">
                            {getInitials(viewer.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{viewer.displayName}</div>
                          {viewer.role && (
                            <div className="text-xs text-muted-foreground capitalize truncate">{viewer.role}</div>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="space-y-1">
                        <div className="font-semibold">{viewer.displayName}</div>
                        {viewer.role && (
                          <div className="text-xs text-muted-foreground capitalize">{viewer.role}</div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {t('versioning.collaborationIndicator.viewingFor', { time: formatDistanceToNow(new Date(viewer.startedAt)) })}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalActive === 0 && (
          <div className="text-center py-3 text-xs text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-1 opacity-20" />
            <p>{t('versioning.collaborationIndicator.noOneHere')}</p>
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <TooltipProvider>
        <div className={`flex items-center gap-2 ${className}`} data-testid="version-collaboration-indicator-compact">
          {totalActive > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 border">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{totalActive}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2">
                  {editors.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">
                        <Edit3 className="h-3 w-3" />
                        {t('versioning.collaborationIndicator.editing')}
                      </div>
                      {editors.map((editor) => (
                        <div key={editor.userId} className="text-xs">
                          {editor.displayName} {editor.role ? `(${editor.role})` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                  {viewers.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                        <Eye className="h-3 w-3" />
                        {t('versioning.collaborationIndicator.viewing')}
                      </div>
                      {viewers.map((viewer) => (
                        <div key={viewer.userId} className="text-xs">
                          {viewer.displayName} {viewer.role ? `(${viewer.role})` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <Card className={`p-4 ${className}`} data-testid="version-collaboration-indicator">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('versioning.collaborationIndicator.activeCollaborators')}</h3>
          </div>
          {totalActive > 0 && (
            <Badge variant="outline" className="text-xs">
              {totalActive} {t('versioning.collaborationIndicator.active')}
            </Badge>
          )}
        </div>

        {/* Current Editor */}
        {currentEditor && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <Edit3 className="h-4 w-4" />
              {t('versioning.collaborationIndicator.currentlyEditing')}
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-300 dark:border-orange-700">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="h-10 w-10 border-2 border-orange-500">
                      <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold">
                        {getInitials(currentEditor.displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="space-y-1">
                      <div className="font-semibold">{currentEditor.displayName}</div>
                      {currentEditor.role && (
                        <div className="text-xs text-muted-foreground capitalize">{currentEditor.role}</div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {t('versioning.collaborationIndicator.started', { time: formatDistanceToNow(new Date(currentEditor.startedAt), { addSuffix: true }) })}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="flex-1">
                <div className="font-medium text-sm">{currentEditor.displayName}</div>
                {currentEditor.role && (
                  <Badge variant="outline" className={`text-xs mt-1 ${getRoleBadgeColor(currentEditor.role)}`}>
                    {currentEditor.role}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Viewers */}
        {viewers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Eye className="h-4 w-4" />
              {t('versioning.collaborationIndicator.viewingCount', { count: viewers.length })}
            </div>
            <div className="flex flex-wrap gap-2">
              {viewers.map((viewer) => (
                <TooltipProvider key={viewer.userId}>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-300 dark:border-blue-700 hover-elevate">
                        <Avatar className="h-8 w-8 border-2 border-blue-500">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold">
                            {getInitials(viewer.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="text-left">
                          <div className="text-xs font-medium">{viewer.displayName}</div>
                          {viewer.role && (
                            <div className="text-xs text-muted-foreground capitalize">{viewer.role}</div>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="space-y-1">
                        <div className="font-semibold">{viewer.displayName}</div>
                        {viewer.role && (
                          <div className="text-xs text-muted-foreground capitalize">{viewer.role}</div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {t('versioning.collaborationIndicator.viewingFor', { time: formatDistanceToNow(new Date(viewer.startedAt)) })}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalActive === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>{t('versioning.collaborationIndicator.noActiveCollaborators')}</p>
            <p className="text-xs mt-1">{t('versioning.collaborationIndicator.emptyDescription')}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
