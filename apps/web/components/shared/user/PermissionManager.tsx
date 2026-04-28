import { useState, useMemo, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  getAllPermissions, 
  getPermissionDisplayName, 
  getPermissionCategory,
  getUserEffectivePermissions,
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
  type CustomPermissions
} from "@shared/permissions";
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  Info, 
  Search,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Crown,
  Sparkles,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PermissionManagerProps {
  user: {
    id: string;
    displayName: string;
    role: Role;
    customPermissions?: CustomPermissions | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PermissionManager({ user, open, onOpenChange }: PermissionManagerProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Local state for permission changes - reset when user changes
  const [localCustomPermissions, setLocalCustomPermissions] = useState<CustomPermissions>(() => ({
    enabled: user?.customPermissions?.enabled || [],
    disabled: user?.customPermissions?.disabled || [],
  }));

  // Reset local state when user changes
  useEffect(() => {
    if (user) {
      setLocalCustomPermissions({
        enabled: user.customPermissions?.enabled || [],
        disabled: user.customPermissions?.disabled || [],
      });
      // Expand all categories by default
      const categories = new Set(allPermissions.map(p => getPermissionCategory(p)));
      setExpandedCategories(categories);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Get role permissions (fallback to empty if role is unknown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rolePermissions = user ? (ROLE_PERMISSIONS[user.role] || []) : [];
  
  // Get effective permissions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effectivePermissions = user 
    ? getUserEffectivePermissions(user.role, localCustomPermissions)
    : [];

  // All available permissions
  const allPermissions = getAllPermissions();

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const categories: Record<string, Permission[]> = {};
    
    allPermissions.forEach(permission => {
      const category = getPermissionCategory(permission);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(permission);
    });
    
    return categories;
  }, [allPermissions]);

  // Filter permissions based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return permissionsByCategory;
    }

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, Permission[]> = {};

    Object.entries(permissionsByCategory).forEach(([category, permissions]) => {
      const matchingPermissions = permissions.filter(p => 
        getPermissionDisplayName(p).toLowerCase().includes(query) ||
        p.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );

      if (matchingPermissions.length > 0) {
        filtered[category] = matchingPermissions;
      }
    });

    return filtered;
  }, [permissionsByCategory, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalPermissions = allPermissions.length;
    const activePermissions = effectivePermissions.length;
    const roleCount = rolePermissions.length;
    const customEnabled = localCustomPermissions.enabled?.length || 0;
    const customDisabled = localCustomPermissions.disabled?.length || 0;
    const hasChanges = customEnabled > 0 || customDisabled > 0;

    return {
      totalPermissions,
      activePermissions,
      roleCount,
      customEnabled,
      customDisabled,
      hasChanges,
      percentage: Math.round((activePermissions / totalPermissions) * 100),
    };
  }, [allPermissions, effectivePermissions, rolePermissions, localCustomPermissions]);

  // Check permission state
  const getPermissionState = (permission: Permission): 'role' | 'enabled' | 'disabled' | 'none' => {
    if (localCustomPermissions.disabled?.includes(permission)) {
      return 'disabled';
    }
    if (localCustomPermissions.enabled?.includes(permission)) {
      return 'enabled';
    }
    if (rolePermissions.includes(permission)) {
      return 'role';
    }
    return 'none';
  };

  // Toggle permission
  const togglePermission = (permission: Permission) => {
    const currentState = getPermissionState(permission);
    const hasRolePermission = rolePermissions.includes(permission);
    
    setLocalCustomPermissions(prev => {
      const enabled = prev.enabled || [];
      const disabled = prev.disabled || [];
      
      if (hasRolePermission) {
        if (currentState === 'role') {
          return {
            enabled: enabled.filter(p => p !== permission),
            disabled: [...disabled, permission],
          };
        } else if (currentState === 'disabled') {
          return {
            enabled,
            disabled: disabled.filter(p => p !== permission),
          };
        }
      } else {
        if (currentState === 'none') {
          return {
            enabled: [...enabled, permission],
            disabled: disabled.filter(p => p !== permission),
          };
        } else if (currentState === 'enabled') {
          return {
            enabled: enabled.filter(p => p !== permission),
            disabled,
          };
        }
      }
      
      return prev;
    });
  };

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      return await apiRequest("PATCH", `/api/users/${user.id}`, {
        customPermissions: localCustomPermissions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('admin.permissions.updated'),
        description: t('admin.permissions.updatedDescription', { name: user?.displayName }),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t('admin.permissions.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleReset = () => {
    setLocalCustomPermissions({
      enabled: [],
      disabled: [],
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isMaximized ? 'max-w-[98vw] w-[98vw] h-[98vh]' : 'max-w-5xl h-[90vh]'} p-0 flex flex-col transition-all`}>
        {/* Header Section - Fixed */}
        <div className="flex-shrink-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-background border-b p-4">
          <DialogHeader className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary via-purple-500 to-primary flex items-center justify-center">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  {t('admin.permissions.manageTitle')}
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-sm">
                  {t('admin.permissions.fineTuneAccess')} <strong className="text-foreground">{user.displayName}</strong>
                </DialogDescription>
              </div>

              {/* Actions: Maximize + Role Badge */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="h-7 w-7 p-0"
                  data-testid="button-maximize-dialog"
                >
                  {isMaximized ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Badge className="h-7 px-3 gap-1.5 capitalize text-xs" variant="outline">
                  <Crown className="h-3 w-3 text-primary" />
                  {user.role}
                </Badge>
              </div>
            </div>

            {/* Stats Cards - Compact Grid */}
            <div className="grid grid-cols-5 gap-2">
              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-muted-foreground font-medium">{t('admin.permissions.active')}</span>
                  </div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {stats.activePermissions}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {stats.percentage}%
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs text-muted-foreground font-medium">{t('admin.permissions.fromRole')}</span>
                  </div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.roleCount}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t('admin.permissions.base')}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs text-muted-foreground font-medium">{t('admin.permissions.added')}</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.customEnabled}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t('admin.permissions.custom')}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-xs text-muted-foreground font-medium">{t('admin.permissions.revoked')}</span>
                  </div>
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">
                    {stats.customDisabled}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t('admin.permissions.disabled')}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/50 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-xs text-muted-foreground font-medium">{t('admin.permissions.total')}</span>
                  </div>
                  <div className="text-xl font-bold">
                    {stats.totalPermissions}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t('admin.permissions.system')}
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogHeader>
        </div>

        {/* Content Section - Flexible */}
        <div className="flex-1 flex flex-col overflow-hidden px-4 pt-3 pb-0">
          {/* Info Banner - Compact */}
          <Card className="flex-shrink-0 bg-blue-500/5 border-blue-500/20 mb-3">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Info className="h-3 w-3 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded bg-blue-500/10 flex items-center justify-center">
                        <ShieldCheck className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{t('admin.permissions.roleLabel')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded bg-emerald-500/10 flex items-center justify-center">
                        <ShieldCheck className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('admin.permissions.custom')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded bg-red-500/10 flex items-center justify-center">
                        <ShieldX className="h-2.5 w-2.5 text-red-600 dark:text-red-400" />
                      </div>
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">{t('admin.permissions.revoked')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Bar */}
          <div className="relative flex-shrink-0 mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.permissions.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
              data-testid="input-search-permissions"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
              >
                {t('admin.permissions.clear')}
              </Button>
            )}
          </div>

          {/* Permissions List - Takes all remaining space */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-3">
                {Object.entries(filteredCategories).map(([category, permissions]) => {
                  const isExpanded = expandedCategories.has(category);
                  const categoryStats = {
                    total: permissions.length,
                    active: permissions.filter(p => effectivePermissions.includes(p)).length,
                  };

                  return (
                    <Card key={category} className="overflow-hidden">
                      <Collapsible
                        open={isExpanded}
                        onOpenChange={() => toggleCategory(category)}
                      >
                        <CollapsibleTrigger asChild>
                          <CardHeader className="p-3 cursor-pointer hover-elevate" data-testid={`category-${category}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <CardTitle className="text-sm font-semibold">
                                  {category}
                                </CardTitle>
                                <Badge variant="outline" className="text-xs">
                                  {categoryStats.active} / {categoryStats.total}
                                </Badge>
                              </div>
                              <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                                  style={{
                                    width: `${(categoryStats.active / categoryStats.total) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <CardContent className="p-3 pt-0 space-y-1.5">
                            {permissions.map((permission) => {
                              const state = getPermissionState(permission);
                              const isChecked = effectivePermissions.includes(permission);
                              const _isRolePermission = rolePermissions.includes(permission);
                              
                              return (
                                <div
                                  key={permission}
                                  className="flex items-center gap-2 p-2 rounded-md hover-elevate border border-transparent hover:border-border/50 transition-all"
                                  data-testid={`permission-${permission}`}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => togglePermission(permission)}
                                    data-testid={`checkbox-${permission}`}
                                    className="flex-shrink-0"
                                  />
                                  <Label
                                    htmlFor={permission}
                                    className="flex-1 cursor-pointer text-sm"
                                  >
                                    {getPermissionDisplayName(permission)}
                                  </Label>
                                  
                                  {state === 'role' && (
                                    <Badge variant="outline" className="gap-1 bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs">
                                      <ShieldCheck className="h-2.5 w-2.5" />
                                      {t('admin.permissions.roleLabel')}
                                    </Badge>
                                  )}
                                  {state === 'enabled' && (
                                    <Badge variant="outline" className="gap-1 bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs">
                                      <ShieldCheck className="h-2.5 w-2.5" />
                                      {t('admin.permissions.custom')}
                                    </Badge>
                                  )}
                                  {state === 'disabled' && (
                                    <Badge variant="outline" className="gap-1 bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 text-xs">
                                      <ShieldX className="h-2.5 w-2.5" />
                                      {t('admin.permissions.revoked')}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}

                {Object.keys(filteredCategories).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Filter className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base font-medium">{t('admin.permissions.noResults')}</p>
                    <p className="text-sm mt-1">{t('admin.permissions.tryAdjusting')}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer Actions - Fixed */}
        <div className="flex-shrink-0 border-t bg-muted/30 px-4 py-3">
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!stats.hasChanges}
              data-testid="button-reset-permissions"
              className="gap-1.5 h-9"
              size="sm"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('admin.permissions.resetToDefaults')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-permissions"
              className="gap-1.5 h-9"
              size="sm"
            >
              {saveMutation.isPending ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('admin.permissions.saving')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('admin.permissions.saveChanges')}
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
