import { UseFormReturn } from "react-hook-form";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { UserPlus } from "lucide-react";
import type { User, CreateUserFormData, EditUserFormData, ResetPasswordFormData } from "./userManagement.schemas";

// ─── Create User Dialog ─────────────────────────────────────────────────────
interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<CreateUserFormData>;
  onSubmit: (data: CreateUserFormData) => void;
  isPending: boolean;
}

export function CreateUserDialog({ open, onOpenChange, form, onSubmit, isPending }: CreateUserDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-user">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('admin.userMgmtDialogs.createUser')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="dialog-create-user">
        <DialogHeader>
          <DialogTitle>{t('admin.userMgmtDialogs.createNewUser')}</DialogTitle>
          <DialogDescription>
            {t('admin.userMgmtDialogs.createUserDesc')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.email')}</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" {...field} data-testid="input-create-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.username')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.userMgmtDialogs.username')} {...field} data-testid="input-create-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.password')}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t('admin.userMgmtDialogs.password')} {...field} data-testid="input-create-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.displayName')}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t('admin.userMgmtDialogs.displayNamePlaceholder')} 
                      {...field} 
                      data-testid="input-create-displayName"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.role')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-role">
                        <SelectValue placeholder={t('admin.userMgmtDialogs.selectRole')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* System Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {t('admin.userMgmtDialogs.systemRoles')}
                      </div>
                      <SelectItem value="super_admin" data-testid="option-role-super-admin">{t('admin.userMgmtDialogs.superAdmin')}</SelectItem>

                      {/* Core Organizational Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        {t('admin.userMgmtDialogs.coreRoles')}
                      </div>
                      <SelectItem value="analyst" data-testid="option-role-analyst">{t('admin.userMgmtDialogs.analyst')}</SelectItem>
                      <SelectItem value="specialist" data-testid="option-role-specialist">{t('admin.userMgmtDialogs.specialist')}</SelectItem>
                      <SelectItem value="manager" data-testid="option-role-manager">{t('admin.userMgmtDialogs.manager')}</SelectItem>
                      <SelectItem value="director" data-testid="option-role-director">{t('admin.userMgmtDialogs.director')}</SelectItem>

                      {/* Portfolio & PMO Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {t('admin.userMgmtDialogs.portfolioRoles')}
                      </div>
                      <SelectItem value="portfolio_manager" data-testid="option-role-portfolio-manager">{t('admin.userMgmtDialogs.portfolioManager')}</SelectItem>
                      <SelectItem value="project_manager" data-testid="option-role-project-manager">{t('admin.userMgmtDialogs.projectManager')}</SelectItem>
                      <SelectItem value="pmo_director" data-testid="option-role-pmo-director">{t('admin.userMgmtDialogs.pmoDirector')}</SelectItem>
                      <SelectItem value="pmo_analyst" data-testid="option-role-pmo-analyst">{t('admin.userMgmtDialogs.pmoAnalyst')}</SelectItem>
                      
                      {/* Procurement Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        {t('admin.userMgmtDialogs.procurementRoles')}
                      </div>
                      <SelectItem value="tender_manager" data-testid="option-role-tender-manager">{t('admin.userMgmtDialogs.tenderManager')}</SelectItem>
                      
                      {/* Specialized Team Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        {t('admin.userMgmtDialogs.specializedRoles')}
                      </div>
                      <SelectItem value="technical_analyst" data-testid="option-role-technical-analyst">{t('admin.userMgmtDialogs.technicalAnalyst')}</SelectItem>
                      <SelectItem value="security_analyst" data-testid="option-role-security-analyst">{t('admin.userMgmtDialogs.securityAnalyst')}</SelectItem>
                      <SelectItem value="business_analyst" data-testid="option-role-business-analyst">{t('admin.userMgmtDialogs.businessAnalyst')}</SelectItem>
                      <SelectItem value="project_analyst" data-testid="option-role-project-analyst">{t('admin.userMgmtDialogs.projectAnalyst')}</SelectItem>
                      <SelectItem value="finance_analyst" data-testid="option-role-finance-analyst">{t('admin.userMgmtDialogs.financeAnalyst')}</SelectItem>
                      <SelectItem value="compliance_analyst" data-testid="option-role-compliance-analyst">{t('admin.userMgmtDialogs.complianceAnalyst')}</SelectItem>
                      <SelectItem value="data_analyst" data-testid="option-role-data-analyst">{t('admin.userMgmtDialogs.dataAnalyst')}</SelectItem>
                      <SelectItem value="qa_analyst" data-testid="option-role-qa-analyst">{t('admin.userMgmtDialogs.qaAnalyst')}</SelectItem>
                      <SelectItem value="infrastructure_engineer" data-testid="option-role-infrastructure-engineer">{t('admin.userMgmtDialogs.infrastructureEngineer')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="organizationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Roads and Transport Authority" {...field} value={field.value || ""} data-testid="input-create-organizationName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="organizationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-organizationType">
                        <SelectValue placeholder="Select organization type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="semi-government">Semi-government</SelectItem>
                      <SelectItem value="public-private-partnership">Public-private partnership</SelectItem>
                      <SelectItem value="private-sector">Private sector</SelectItem>
                      <SelectItem value="non-profit">Non-profit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.departmentOptional')}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t('admin.userMgmtDialogs.departmentPlaceholder')} 
                      {...field} 
                      data-testid="input-create-department"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departmentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Digital Transformation Office" {...field} value={field.value || ""} data-testid="input-create-departmentName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-create"
              >
                {t('admin.userMgmtDialogs.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-submit-create"
              >
                {isPending ? t('admin.userMgmtDialogs.creating') : t('admin.userMgmtDialogs.createUser')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit User Dialog ────────────────────────────────────────────────────────
interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<EditUserFormData>;
  onSubmit: (data: EditUserFormData) => void;
  isPending: boolean;
  selectedUser: User | null;
  currentUser: { id: string } | null;
}

export function EditUserDialog({ open, onOpenChange, form, onSubmit, isPending, selectedUser, currentUser }: EditUserDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-edit-user">
        <DialogHeader>
          <DialogTitle>{t('admin.userMgmtDialogs.editUser')}</DialogTitle>
          <DialogDescription>
            {t('admin.userMgmtDialogs.editUserDesc')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.displayName')}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t('admin.userMgmtDialogs.displayNamePlaceholder')} 
                      {...field} 
                      data-testid="input-edit-displayName"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.email')}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="user@example.com" 
                      {...field} 
                      data-testid="input-edit-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.role')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={selectedUser?.id === currentUser?.id}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-role">
                        <SelectValue placeholder={t('admin.userMgmtDialogs.selectRole')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* System Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {t('admin.userMgmtDialogs.systemRoles')}
                      </div>
                      <SelectItem value="super_admin">{t('admin.userMgmtDialogs.superAdmin')}</SelectItem>

                      {/* Core Organizational Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        {t('admin.userMgmtDialogs.coreRoles')}
                      </div>
                      <SelectItem value="analyst">{t('admin.userMgmtDialogs.analyst')}</SelectItem>
                      <SelectItem value="specialist">{t('admin.userMgmtDialogs.specialist')}</SelectItem>
                      <SelectItem value="manager">{t('admin.userMgmtDialogs.manager')}</SelectItem>
                      <SelectItem value="director">{t('admin.userMgmtDialogs.director')}</SelectItem>
                      
                      {/* Portfolio & PMO Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        {t('admin.userMgmtDialogs.portfolioRoles')}
                      </div>
                      <SelectItem value="portfolio_manager">{t('admin.userMgmtDialogs.portfolioManager')}</SelectItem>
                      <SelectItem value="project_manager">{t('admin.userMgmtDialogs.projectManager')}</SelectItem>
                      <SelectItem value="pmo_director">{t('admin.userMgmtDialogs.pmoDirector')}</SelectItem>
                      <SelectItem value="pmo_analyst">{t('admin.userMgmtDialogs.pmoAnalyst')}</SelectItem>
                      
                      {/* Procurement Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        {t('admin.userMgmtDialogs.procurementRoles')}
                      </div>
                      <SelectItem value="tender_manager">{t('admin.userMgmtDialogs.tenderManager')}</SelectItem>
                      
                      {/* Specialized Team Roles */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                        {t('admin.userMgmtDialogs.specializedRoles')}
                      </div>
                      <SelectItem value="technical_analyst">{t('admin.userMgmtDialogs.technicalAnalyst')}</SelectItem>
                      <SelectItem value="security_analyst">{t('admin.userMgmtDialogs.securityAnalyst')}</SelectItem>
                      <SelectItem value="business_analyst">{t('admin.userMgmtDialogs.businessAnalyst')}</SelectItem>
                      <SelectItem value="project_analyst">{t('admin.userMgmtDialogs.projectAnalyst')}</SelectItem>
                      <SelectItem value="finance_analyst">{t('admin.userMgmtDialogs.financeAnalyst')}</SelectItem>
                      <SelectItem value="compliance_analyst">{t('admin.userMgmtDialogs.complianceAnalyst')}</SelectItem>
                      <SelectItem value="data_analyst">{t('admin.userMgmtDialogs.dataAnalyst')}</SelectItem>
                      <SelectItem value="qa_analyst">{t('admin.userMgmtDialogs.qaAnalyst')}</SelectItem>
                      <SelectItem value="infrastructure_engineer">{t('admin.userMgmtDialogs.infrastructureEngineer')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedUser?.id === currentUser?.id && (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.userMgmtDialogs.cannotModifyOwnRole')}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="organizationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Roads and Transport Authority" {...field} value={field.value || ""} data-testid="input-edit-organizationName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="organizationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-organizationType">
                        <SelectValue placeholder="Select organization type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="government">Government</SelectItem>
                      <SelectItem value="semi-government">Semi-government</SelectItem>
                      <SelectItem value="public-private-partnership">Public-private partnership</SelectItem>
                      <SelectItem value="private-sector">Private sector</SelectItem>
                      <SelectItem value="non-profit">Non-profit</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.departmentOptional')}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={t('admin.userMgmtDialogs.departmentPlaceholder')} 
                      {...field} 
                      data-testid="input-edit-department"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="departmentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Digital Transformation Office" {...field} value={field.value || ""} data-testid="input-edit-departmentName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{t('admin.userMgmtDialogs.activeStatus')}</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      {selectedUser?.id === currentUser?.id 
                        ? t('admin.userMgmtDialogs.cannotDeactivateOwn')
                        : t('admin.userMgmtDialogs.allowAccess')
                      }
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={selectedUser?.id === currentUser?.id}
                      data-testid="switch-edit-isActive"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit"
              >
                {t('admin.userMgmtDialogs.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-submit-edit"
              >
                {isPending ? t('admin.userMgmtDialogs.updating') : t('admin.userMgmtDialogs.updateUser')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset Password Dialog ───────────────────────────────────────────────────
interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ResetPasswordFormData>;
  onSubmit: (data: ResetPasswordFormData) => void;
  isPending: boolean;
  selectedUser: User | null;
}

export function ResetPasswordDialog({ open, onOpenChange, form, onSubmit, isPending, selectedUser }: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-reset-password">
        <DialogHeader>
          <DialogTitle>{t('admin.userMgmtDialogs.resetPassword')}</DialogTitle>
          <DialogDescription>
            {t('admin.userMgmtDialogs.setNewPasswordFor', { name: selectedUser?.displayName })}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.newPassword')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder={t('admin.userMgmtDialogs.enterNewPassword')} 
                      {...field} 
                      data-testid="input-new-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.userMgmtDialogs.confirmPassword')}</FormLabel>
                  <FormControl>
                    <Input 
                      type="password"
                      placeholder={t('admin.userMgmtDialogs.confirmNewPassword')} 
                      {...field} 
                      data-testid="input-confirm-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-reset-password"
              >
                {t('admin.userMgmtDialogs.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={isPending}
                data-testid="button-submit-reset-password"
              >
                {isPending ? t('admin.userMgmtDialogs.resetting') : t('admin.userMgmtDialogs.resetPassword')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
