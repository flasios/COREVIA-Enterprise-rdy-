import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, GitBranch } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useCreateBranch, useBranches } from "@/hooks/useBranches";
import { useQuery } from "@tanstack/react-query";
import type { ReportVersion } from "@shared/schema";

const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").max(100, "Branch name too long"),
  description: z.string().optional(),
  parentBranchId: z.string().optional(),
  originVersionId: z.string().optional(),
});

type CreateBranchFormData = z.infer<typeof createBranchSchema>;

interface CreateBranchDialogProps {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBranchCreated?: () => void;
  defaultOriginVersionId?: string;
}

export function CreateBranchDialog({
  reportId,
  open,
  onOpenChange,
  onBranchCreated,
  defaultOriginVersionId
}: CreateBranchDialogProps) {
  const createBranchMutation = useCreateBranch(reportId);
  const { t } = useTranslation();
  const { data: branches } = useBranches(reportId);
  const { data: versionsResponse } = useQuery<{ data: ReportVersion[] }>({
    queryKey: ['/api/demand-reports', reportId, 'versions'],
    enabled: open && !!reportId,
  });

  const versions = versionsResponse?.data || [];

  const form = useForm<CreateBranchFormData>({
    resolver: zodResolver(createBranchSchema),
    defaultValues: {
      name: "",
      description: "",
      parentBranchId: undefined,
      originVersionId: defaultOriginVersionId || undefined,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        description: "",
        parentBranchId: undefined,
        originVersionId: defaultOriginVersionId || undefined,
      });
    }
  }, [open, defaultOriginVersionId, form]);

  const handleSubmit = async (data: CreateBranchFormData) => {
    try {
      await createBranchMutation.mutateAsync({
        name: data.name,
        description: data.description,
        parentBranchId: data.parentBranchId,
        originVersionId: data.originVersionId,
      });

      onOpenChange(false);
      onBranchCreated?.();
    } catch (error) {
      // Error handling is done in the mutation hook
      console.error("Failed to create branch:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]" data-testid="dialog-create-branch">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            {t('versioning.createBranch.title')}
          </DialogTitle>
          <DialogDescription>
            {t('versioning.createBranch.description')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('versioning.createBranch.branchName')} <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('versioning.createBranch.branchNamePlaceholder')}
                      data-testid="input-branch-name"
                    />
                  </FormControl>
                  <FormDescription>
                    {t('versioning.createBranch.branchNameHelp')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('versioning.createBranch.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={t('versioning.createBranch.descriptionPlaceholder')}
                      rows={3}
                      data-testid="textarea-branch-description"
                    />
                  </FormControl>
                  <FormDescription>
                    {t('versioning.createBranch.descriptionHelp')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentBranchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('versioning.createBranch.parentBranch')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-parent-branch">
                        <SelectValue placeholder={t('versioning.createBranch.noneFromMain')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('versioning.createBranch.noneFromMain')}</SelectItem>
                      {branches?.filter(b => b.status === "active").map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('versioning.createBranch.parentBranchHelp')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="originVersionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('versioning.createBranch.branchFromVersion')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-origin-version">
                        <SelectValue placeholder={t('versioning.createBranch.latestVersion')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="latest">{t('versioning.createBranch.latestVersion')}</SelectItem>
                      {versions.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          {version.versionNumber} - {(version.changesSummary || t('versioning.createBranch.noSummary')).substring(0, 50)}
                          {(version.changesSummary || "").length > 50 ? "..." : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('versioning.createBranch.branchFromVersionHelp')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createBranchMutation.isPending}
                data-testid="button-cancel-branch"
              >
                {t('versioning.createBranch.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createBranchMutation.isPending}
                data-testid="button-create-branch"
              >
                {createBranchMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t('versioning.createBranch.createBranch')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
