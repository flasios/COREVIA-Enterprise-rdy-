import { useState, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Can } from "@/components/auth/Can";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

import { PermissionManager } from "@/components/shared/user";
import { Users, UserCheck, UserX, Search, X, Filter, Shield, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { getAllRoles, getRoleDisplayName, getRoleDescription } from "@shared/permissions";
import type { Role } from "@shared/permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { User, createUserFormSchema, editUserFormSchema, resetPasswordFormSchema } from "./userManagement.schemas";
import { CreateUserDialog, EditUserDialog, ResetPasswordDialog } from "./userManagement.dialogs";

export default function UserManagement() {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();

  // State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch users
  const { data: usersResponse, isLoading } = useQuery<{ success: boolean; data: User[] }>({
    queryKey: ["/api/users"],
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const users = usersResponse?.data ?? [];

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.organizationName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.departmentName || user.department || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.isActive) ||
        (statusFilter === "inactive" && !user.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.isActive).length;
    const inactive = total - active;

    // Count users by role dynamically
    const roleCounts = getAllRoles().reduce((acc, role) => {
      acc[role] = users.filter(u => u.role === role).length;
      return acc;
    }, {} as Record<Role, number>);

    // Core roles
    const coreRoles = (roleCounts.analyst || 0) + (roleCounts.specialist || 0) + (roleCounts.manager || 0) + (roleCounts.director || 0);

    // Portfolio & PMO roles
    const portfolioPmoRoles = (roleCounts.portfolio_manager || 0) + (roleCounts.project_manager || 0) + (roleCounts.pmo_director || 0) + (roleCounts.pmo_analyst || 0);

    // Procurement roles
    const procurementRoles = roleCounts.tender_manager || 0;

    // Specialized team roles (remainder)
    const specializedRoles = total - coreRoles - portfolioPmoRoles - procurementRoles;

    return {
      total,
      active,
      inactive,
      coreRoles,
      portfolioPmoRoles,
      procurementRoles,
      specializedRoles,
      roleCounts
    };
  }, [users]);

  // Create user form
  const createForm = useForm<z.infer<typeof createUserFormSchema>>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      displayName: "",
      role: "analyst",
      department: "",
      organizationId: "",
      organizationName: "",
      organizationType: undefined,
      departmentId: "",
      departmentName: "",
    },
  });

  // Edit user form
  const editForm = useForm<z.infer<typeof editUserFormSchema>>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      role: "analyst",
      department: "",
      organizationId: "",
      organizationName: "",
      organizationType: undefined,
      departmentId: "",
      departmentName: "",
      isActive: true,
    },
  });

  // Reset password form
  const resetPasswordForm = useForm<z.infer<typeof resetPasswordFormSchema>>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createUserFormSchema>) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('admin.userCreated'),
        description: t('admin.userCreatedDesc'),
      });
      setCreateDialogOpen(false);
      createForm.reset();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorCreatingUser'),
        description: error.message || t('admin.failedCreateUser'),
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof editUserFormSchema> }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('admin.userUpdated'),
        description: t('admin.userUpdatedDesc'),
      });
      setEditDialogOpen(false);
      setSelectedUser(null);
      editForm.reset();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorUpdatingUser'),
        description: error.message || t('admin.failedUpdateUser'),
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/users/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('admin.userDeleted'),
        description: t('admin.userDeletedDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorDeletingUser'),
        description: error.message || t('admin.failedDeleteUser'),
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      return await apiRequest("PATCH", `/api/users/${id}`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t('admin.passwordReset'),
        description: t('admin.passwordResetDesc'),
      });
      setResetPasswordDialogOpen(false);
      setSelectedUser(null);
      resetPasswordForm.reset();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorResettingPassword'),
        description: error.message || t('admin.failedResetPassword'),
        variant: "destructive",
      });
    },
  });

  // Handle create user submit
  const handleCreateUser = (data: z.infer<typeof createUserFormSchema>) => {
    createUserMutation.mutate(data);
  };

  // Handle edit user submit
  const handleEditUser = (data: z.infer<typeof editUserFormSchema>) => {
    if (!selectedUser) return;
    updateUserMutation.mutate({ id: selectedUser.id, data });
  };

  // Handle reset password submit
  const handleResetPassword = (data: z.infer<typeof resetPasswordFormSchema>) => {
    if (!selectedUser) return;
    resetPasswordMutation.mutate({ id: selectedUser.id, password: data.newPassword });
  };

  // Open edit dialog
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    editForm.reset({
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      department: user.department || "",
      organizationId: user.organizationId || "",
      organizationName: user.organizationName || "",
      organizationType: user.organizationType || undefined,
      departmentId: user.departmentId || "",
      departmentName: user.departmentName || user.department || "",
      isActive: user.isActive,
    });
    setEditDialogOpen(true);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const hasFilters = searchQuery || roleFilter !== "all" || statusFilter !== "all";

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">{t('admin.userManagement')}</h1>
            <p className="text-muted-foreground mt-1">{t('admin.userManagementDesc')}</p>
          </div>

          <Can permissions={["user:create"]}>
            <CreateUserDialog
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              form={createForm}
              onSubmit={handleCreateUser}
              isPending={createUserMutation.isPending}
            />
          </Can>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card data-testid="card-stats-total">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.active} active, {stats.inactive} inactive
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-core-roles">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.coreRoles')}</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-core-roles-count">{stats.coreRoles}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.coreRolesDesc')}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-portfolio-pmo">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.portfolioPmo')}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-portfolio-pmo-count">{stats.portfolioPmoRoles}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.portfolioPmoDesc')}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-specialized-roles">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.specialized')}</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-specialized-roles-count">{stats.specializedRoles}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.specializedDesc')}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-stats-directors">
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.directors')}</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-directors-count">{stats.roleCounts.director || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('admin.directorsDesc')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('admin.searchUsers')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                  data-testid="input-search-users"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-filter-role">
                    <SelectValue placeholder={t('auth.role')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.allRoles')}</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {t('admin.systemRoles')}
                    </div>
                    <SelectItem value="super_admin">{t('auth.roles.super_admin')}</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {t('admin.coreRolesLabel')}
                    </div>
                    <SelectItem value="analyst">{t('auth.roles.analyst')}</SelectItem>
                    <SelectItem value="specialist">{t('auth.roles.specialist')}</SelectItem>
                    <SelectItem value="manager">{t('auth.roles.manager')}</SelectItem>
                    <SelectItem value="director">{t('auth.roles.director')}</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                      {t('admin.portfolioPmoLabel')}
                    </div>
                    <SelectItem value="portfolio_manager">{t('auth.roles.portfolio_manager')}</SelectItem>
                    <SelectItem value="project_manager">{t('auth.roles.project_manager')}</SelectItem>
                    <SelectItem value="pmo_director">{t('auth.roles.pmo_director')}</SelectItem>
                    <SelectItem value="pmo_analyst">{t('auth.roles.pmo_analyst')}</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                      {t('admin.procurement')}
                    </div>
                    <SelectItem value="tender_manager">{t('auth.roles.tender_manager')}</SelectItem>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                      {t('admin.specializedRoles')}
                    </div>
                    <SelectItem value="technical_analyst">{t('auth.roles.technical_analyst')}</SelectItem>
                    <SelectItem value="security_analyst">{t('auth.roles.security_analyst')}</SelectItem>
                    <SelectItem value="business_analyst">{t('auth.roles.business_analyst')}</SelectItem>
                    <SelectItem value="project_analyst">{t('auth.roles.project_analyst')}</SelectItem>
                    <SelectItem value="finance_analyst">{t('auth.roles.finance_analyst')}</SelectItem>
                    <SelectItem value="compliance_analyst">{t('auth.roles.compliance_analyst')}</SelectItem>
                    <SelectItem value="data_analyst">{t('auth.roles.data_analyst')}</SelectItem>
                    <SelectItem value="qa_analyst">{t('auth.roles.qa_analyst')}</SelectItem>
                    <SelectItem value="infrastructure_engineer">{t('auth.roles.infrastructure_engineer')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                    <SelectValue placeholder={t('app.status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.allStatus')}</SelectItem>
                    <SelectItem value="active">{t('app.active')}</SelectItem>
                    <SelectItem value="inactive">{t('app.inactive')}</SelectItem>
                  </SelectContent>
                </Select>

                {hasFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('app.clear')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8" data-testid="loading-users">
                <p className="text-muted-foreground">{t('admin.loadingUsers')}</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8" data-testid="no-users">
                <UserX className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {hasFilters ? t('admin.noUsersMatch') : t('admin.noUsersFound')}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('app.name')}</TableHead>
                      <TableHead>{t('auth.email')}</TableHead>
                      <TableHead>{t('auth.username')}</TableHead>
                      <TableHead>{t('auth.role')}</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>{t('auth.department')}</TableHead>
                      <TableHead>{t('app.status')}</TableHead>
                      <TableHead>{t('admin.lastLogin')}</TableHead>
                      <TableHead className="text-right">{t('app.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium" data-testid={`text-name-${user.id}`}>
                          {user.displayName}
                        </TableCell>
                        <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                        <TableCell data-testid={`text-username-${user.id}`}>{user.username}</TableCell>
                        <TableCell data-testid={`badge-role-${user.id}`}>
                          <Tooltip>
                            <TooltipTrigger>
                              <span>
                                <Badge
                                  variant={
                                    user.role === "manager" || user.role === "director" ? "default" :
                                    user.role === "specialist" ? "secondary" :
                                    "outline"
                                  }
                                >
                                  {getRoleDisplayName(user.role)}
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-xs">{getRoleDescription(user.role)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell data-testid={`text-organization-${user.id}`}>
                          <div className="max-w-[220px]">
                            <div className="truncate font-medium">{user.organizationName || "-"}</div>
                            {user.organizationType && (
                              <div className="text-xs text-muted-foreground">{user.organizationType.replaceAll("-", " ")}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-department-${user.id}`}>
                          {user.departmentName || user.department || "-"}
                        </TableCell>
                        <TableCell data-testid={`badge-status-${user.id}`}>
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? t('app.active') : t('app.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-lastLogin-${user.id}`}>
                          {user.lastLogin
                            ? format(new Date(user.lastLogin), "MMM d, yyyy")
                            : t('app.never')
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Can permissions={["user:manage"]}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setPermissionDialogOpen(true);
                                }}
                                data-testid={`button-permissions-${user.id}`}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                {t('app.permissions')}
                              </Button>
                            </Can>
                            <Can permissions={["user:update"]}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(user)}
                                data-testid={`button-edit-${user.id}`}
                              >
                                {t('app.edit')}
                              </Button>
                            </Can>
                            <Can permissions={["user:update"]}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  resetPasswordForm.reset();
                                  setResetPasswordDialogOpen(true);
                                }}
                                data-testid={`button-reset-password-${user.id}`}
                              >
                                <KeyRound className="h-4 w-4 mr-1" />
                                {t('app.resetPassword')}
                              </Button>
                            </Can>
                            <Can permissions={["user:delete"]}>
                              {user.id !== currentUser?.id && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(t('admin.confirmDeleteUser', { name: user.displayName }))) {
                                      deleteUserMutation.mutate(user.id);
                                    }
                                  }}
                                  data-testid={`button-delete-${user.id}`}
                                >
                                  {t('app.delete')}
                                </Button>
                              )}
                            </Can>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        form={editForm}
        onSubmit={handleEditUser}
        isPending={updateUserMutation.isPending}
        selectedUser={selectedUser}
        currentUser={currentUser}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        form={resetPasswordForm}
        onSubmit={handleResetPassword}
        isPending={resetPasswordMutation.isPending}
        selectedUser={selectedUser}
      />

      {/* Permission Manager Dialog */}
      <PermissionManager
        user={selectedUser}
        open={permissionDialogOpen}
        onOpenChange={setPermissionDialogOpen}
      />
    </div>
  );
}
