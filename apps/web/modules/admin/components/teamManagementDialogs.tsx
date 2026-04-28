import { UseFormReturn } from "react-hook-form";
import { useTranslation } from 'react-i18next';
import { Can } from "@/components/auth/Can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserPlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Team, TeamMember, User } from "@shared/schema";
import type { CreateTeamFormData, EditTeamFormData } from "../types/teamManagement";

// ─── Create Team Dialog ──────────────────────────────────────────────────────

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CreateTeamFormData>;
  onSubmit: (data: CreateTeamFormData) => void;
  isPending: boolean;
}

export function CreateTeamDialog({ open, onOpenChange, form, onSubmit, isPending }: CreateTeamDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-team">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('admin.teamDialogs.createTeam')}
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-create-team">
        <DialogHeader>
          <DialogTitle>{t('admin.teamDialogs.createNewTeam')}</DialogTitle>
          <DialogDescription>
            {t('admin.teamDialogs.createTeamDesc')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.teamDialogs.teamName')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.teamDialogs.teamNamePlaceholder')} data-testid="input-team-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.teamDialogs.description')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.teamDialogs.descriptionPlaceholder')} data-testid="input-team-description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.teamDialogs.colorLabel')}</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input type="color" className="w-20 h-10" data-testid="input-team-color" {...field} />
                      <Input value={field.value} onChange={field.onChange} placeholder="#3B82F6" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="submit" data-testid="button-submit-create-team" disabled={isPending}>
                {isPending ? t('admin.teamDialogs.creating') : t('admin.teamDialogs.createTeam')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Team Dialog ────────────────────────────────────────────────────────

interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<EditTeamFormData>;
  onSubmit: (data: EditTeamFormData) => void;
  isPending: boolean;
}

export function EditTeamDialog({ open, onOpenChange, form, onSubmit, isPending }: EditTeamDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-team">
        <DialogHeader>
          <DialogTitle>{t('admin.teamDialogs.editTeam')}</DialogTitle>
          <DialogDescription>
            {t('admin.teamDialogs.updateTeamInfo')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.teamDialogs.teamName')}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-edit-team-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.teamDialogs.description')}</FormLabel>
                  <FormControl>
                    <Input data-testid="input-edit-team-description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.teamDialogs.colorLabel')}</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input type="color" className="w-20 h-10" data-testid="input-edit-team-color" {...field} />
                      <Input value={field.value} onChange={field.onChange} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="submit" data-testid="button-submit-edit-team" disabled={isPending}>
                {isPending ? t('admin.teamDialogs.updating') : t('admin.teamDialogs.updateTeam')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Members Dialog ─────────────────────────────────────────────────────

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTeam: Team | null;
  members: Array<TeamMember & { user: User }>;
  membersLoading: boolean;
  availableUsers: User[];
  onAddMember: (params: { teamId: string; userId: string; role: string }) => void;
  addMemberPending: boolean;
  onRemoveMember: (params: { teamId: string; userId: string }) => void;
}

export function TeamMembersDialog({
  open,
  onOpenChange,
  selectedTeam,
  members,
  membersLoading,
  availableUsers,
  onAddMember,
  addMemberPending,
  onRemoveMember,
}: TeamMembersDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="dialog-team-members">
        <DialogHeader>
          <DialogTitle>{t('admin.teamDialogs.teamMembersTitle', { name: selectedTeam?.name })}</DialogTitle>
          <DialogDescription>
            {t('admin.teamDialogs.manageMembers')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Add Member Section */}
          <Can permissions={["team:manage"]}>
            <div className="flex gap-2">
              <Select
                onValueChange={(userId) => {
                  if (selectedTeam) {
                    onAddMember({ teamId: selectedTeam.id, userId, role: "member" });
                  }
                }}
                disabled={availableUsers.length === 0 || addMemberPending}
              >
                <SelectTrigger className="flex-1" data-testid="select-add-member">
                  <SelectValue placeholder={t('admin.teamDialogs.selectUserToAdd')} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id} data-testid={`option-user-${user.id}`}>
                      {user.displayName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Can>

          {/* Members List */}
          {membersLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t('admin.teamDialogs.loadingMembers')}</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.teamDialogs.noMembers')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.teamDialogs.name')}</TableHead>
                    <TableHead>{t('admin.teamDialogs.email')}</TableHead>
                    <TableHead>{t('admin.teamDialogs.roleInTeam')}</TableHead>
                    <TableHead>{t('admin.teamDialogs.joined')}</TableHead>
                    <TableHead className="text-right">{t('admin.teamDialogs.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} data-testid={`row-member-${member.userId}`}>
                      <TableCell className="font-medium">{member.user.displayName}</TableCell>
                      <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{member.role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(member.joinedAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Can permissions={["team:manage"]}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedTeam && confirm(t('admin.teamDialogs.confirmRemoveMember'))) {
                                onRemoveMember({ teamId: selectedTeam.id, userId: member.userId });
                              }
                            }}
                            data-testid={`button-remove-member-${member.userId}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
