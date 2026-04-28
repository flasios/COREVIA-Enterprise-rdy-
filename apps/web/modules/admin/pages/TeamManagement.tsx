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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

import { Users, Search, X, Trash2, Edit, Shield } from "lucide-react";
import { format } from "date-fns";
import type { Team, TeamMember, User } from "@shared/schema";
import { createTeamFormSchema, editTeamFormSchema, type CreateTeamFormData, type EditTeamFormData } from "./teamManagement.schemas";
import { CreateTeamDialog, EditTeamDialog, TeamMembersDialog } from "./teamManagement.dialogs";

export default function TeamManagement() {
  const { t } = useTranslation();
  const { currentUser: _currentUser } = useAuth();
  const { toast } = useToast();

  // State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch teams
  const { data: teamsResponse, isLoading: teamsLoading } = useQuery<{ success: boolean; data: Team[] }>({
    queryKey: ["/api/teams"],
  });

  // Fetch users for member assignment
  const { data: usersResponse } = useQuery<{ success: boolean; data: User[] }>({
    queryKey: ["/api/users"],
  });

  // Fetch team members when a team is selected
  const { data: membersResponse, isLoading: membersLoading } = useQuery<{ success: boolean; data: Array<TeamMember & { user: User }> }>({
    queryKey: ["/api/teams", selectedTeam?.id, "members"],
    enabled: !!selectedTeam?.id && membersDialogOpen,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const teams = teamsResponse?.data ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const users = usersResponse?.data ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const members = membersResponse?.data ?? [];

  // Filter teams
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (team.description && team.description.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesSearch;
    });
  }, [teams, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: teams.length,
      active: teams.filter(t => new Date(t.updatedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000).length,
    };
  }, [teams]);

  // Create team form
  const createForm = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3B82F6",
    },
  });

  // Edit team form
  const editForm = useForm<EditTeamFormData>({
    resolver: zodResolver(editTeamFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#3B82F6",
    },
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (data: CreateTeamFormData) => {
      return await apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: t('admin.teamCreated'),
        description: t('admin.teamCreatedDesc'),
      });
      setCreateDialogOpen(false);
      createForm.reset();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorCreatingTeam'),
        description: error.message || t('admin.failedCreateTeam'),
        variant: "destructive",
      });
    },
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditTeamFormData }) => {
      return await apiRequest("PATCH", `/api/teams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: t('admin.teamUpdated'),
        description: t('admin.teamUpdatedDesc'),
      });
      setEditDialogOpen(false);
      setSelectedTeam(null);
      editForm.reset();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorUpdatingTeam'),
        description: error.message || t('admin.failedUpdateTeam'),
        variant: "destructive",
      });
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/teams/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: t('admin.teamDeleted'),
        description: t('admin.teamDeletedDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorDeletingTeam'),
        description: error.message || t('admin.failedDeleteTeam'),
        variant: "destructive",
      });
    },
  });

  // Add team member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: string; userId: string; role: string }) => {
      return await apiRequest("POST", `/api/teams/${teamId}/members`, { userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeam?.id, "members"] });
      toast({
        title: t('admin.memberAdded'),
        description: t('admin.memberAddedDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorAddingMember'),
        description: error.message || t('admin.failedAddMember'),
        variant: "destructive",
      });
    },
  });

  // Remove team member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      return await apiRequest("DELETE", `/api/teams/${teamId}/members/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeam?.id, "members"] });
      toast({
        title: t('admin.memberRemoved'),
        description: t('admin.memberRemovedDesc'),
      });
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast({
        title: t('admin.errorRemovingMember'),
        description: error.message || t('admin.failedRemoveMember'),
        variant: "destructive",
      });
    },
  });

  // Handle create team submit
  const handleCreateTeam = (data: CreateTeamFormData) => {
    createTeamMutation.mutate(data);
  };

  // Handle edit team submit
  const handleEditTeam = (data: EditTeamFormData) => {
    if (!selectedTeam) return;
    updateTeamMutation.mutate({ id: selectedTeam.id, data });
  };

  // Handle delete team
  const handleDeleteTeam = (teamId: string) => {
    if (confirm(t('admin.deleteTeamConfirm'))) {
      deleteTeamMutation.mutate(teamId);
    }
  };

  // Handle edit team click
  const handleEditClick = (team: Team) => {
    setSelectedTeam(team);
    editForm.reset({
      name: team.name,
      description: team.description || "",
      color: team.color || "#3B82F6",
    });
    setEditDialogOpen(true);
  };

  // Handle view members click
  const handleViewMembers = (team: Team) => {
    setSelectedTeam(team);
    setMembersDialogOpen(true);
  };

  // Get available users for adding to team
  const availableUsers = useMemo(() => {
    const memberUserIds = members.map(m => m.userId);
    return users.filter(u => !memberUserIds.includes(u.id));
  }, [users, members]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">{t('admin.teamManagement')}</h1>
            <p className="text-muted-foreground mt-1">{t('admin.teamManagementDesc')}</p>
          </div>

          <Can permissions={["team:create"]}>
            <CreateTeamDialog
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              form={createForm}
              onSubmit={handleCreateTeam}
              isPending={createTeamMutation.isPending}
            />
          </Can>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.totalTeams')}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-teams">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('admin.activeDays')}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-teams">{stats.active}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t('admin.searchTeams')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-teams"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 px-2"
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teams Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.teamsCount', { count: filteredTeams.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <div className="text-center py-8 text-muted-foreground">{t('admin.loadingTeams')}</div>
            ) : filteredTeams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? t('admin.noTeamsMatch') : t('admin.noTeamsYet')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.teamName')}</TableHead>
                      <TableHead>{t('app.description')}</TableHead>
                      <TableHead>{t('app.color')}</TableHead>
                      <TableHead>{t('app.created')}</TableHead>
                      <TableHead className="text-right">{t('app.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeams.map((team) => (
                      <TableRow key={team.id} data-testid={`row-team-${team.id}`}>
                        <TableCell className="font-medium" data-testid={`text-team-name-${team.id}`}>
                          {team.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`text-team-description-${team.id}`}>
                          {team.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: team.color || "#3B82F6" }} data-testid={`badge-team-color-${team.id}`}>
                            {team.color || "#3B82F6"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(team.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Can permissions={["team:view-members"]}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewMembers(team)}
                                data-testid={`button-view-members-${team.id}`}
                              >
                                <Users className="h-4 w-4 mr-1" />
                                {t('app.members')}
                              </Button>
                            </Can>

                            <Can permissions={["team:update"]}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditClick(team)}
                                data-testid={`button-edit-team-${team.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Can>

                            <Can permissions={["team:delete"]}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTeam(team.id)}
                                data-testid={`button-delete-team-${team.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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

        <EditTeamDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          form={editForm}
          onSubmit={handleEditTeam}
          isPending={updateTeamMutation.isPending}
        />

        <TeamMembersDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          selectedTeam={selectedTeam}
          members={members}
          membersLoading={membersLoading}
          availableUsers={availableUsers}
          onAddMember={(params) => addMemberMutation.mutate(params)}
          addMemberPending={addMemberMutation.isPending}
          onRemoveMember={(params) => removeMemberMutation.mutate(params)}
        />
      </div>
    </div>
  );
}
