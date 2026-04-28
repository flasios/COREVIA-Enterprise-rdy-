import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  Server,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Tag,
  Layers,
  Zap,
} from "lucide-react";
import { fetchControlPlane, registerService } from "@/api/brain";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function NewIntake() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    serviceId: "",
    serviceName: "",
    description: "",
    defaultClassification: "internal",
    isActive: true,
  });
  const [submitted, setSubmitted] = useState(false);

  const registerMutation = useMutation({
    mutationFn: () => registerService(formData),
    onSuccess: (result) => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: result.message || t('brain.newIntake.registerSuccess') });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not register the service";
      toast({
        title: t('brain.newIntake.registerFailed'),
        description: message,
        variant: "destructive",
      });
    },
  });

  const { data: controlPlaneData } = useQuery({
    queryKey: ["control-plane"],
    queryFn: fetchControlPlane,
  });

  const intakeEnabled = controlPlaneData?.state?.intakeEnabled ?? true;
  const policyMode = controlPlaneData?.state?.policyMode || "enforce";
  const isValid = formData.serviceId.length > 0 && formData.serviceName.length > 0;
  const serviceIdValid = /^[a-z0-9_]*$/.test(formData.serviceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !serviceIdValid) return;
    registerMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-emerald-500/20 bg-emerald-500/5 max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">{t('brain.newIntake.successTitle')}</h2>
            <p className="text-muted-foreground mt-2">
              <span className="font-mono font-medium">{formData.serviceId}</span> {t('brain.newIntake.successDescription')}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" onClick={() => navigate("/brain-console/services")}>
                {t('brain.newIntake.viewRegistry')}
              </Button>
              <Button onClick={() => { setSubmitted(false); setFormData({ serviceId: "", serviceName: "", description: "", defaultClassification: "internal", isActive: true }); }}>
                <Plus className="h-4 w-4 mr-2" />
                {t('brain.newIntake.registerAnother')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header strip — full width, compact */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/brain-console/services")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold leading-tight">{t('brain.newIntake.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('brain.newIntake.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={intakeEnabled ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-amber-500/10 text-amber-700 border-amber-500/30"}>
            {intakeEnabled ? t('brain.services.intakeEnabledLabel') : t('brain.services.intakePausedLabel')}
          </Badge>
          <Badge variant="outline" className="text-xs">{t('brain.newIntake.policy')}: {policyMode}</Badge>
        </div>
      </div>

      {!intakeEnabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-700">{t('brain.newIntake.intakePausedTitle')}</p>
            <p className="text-muted-foreground">
              {t('brain.newIntake.intakePausedDescription')}
            </p>
          </div>
        </div>
      )}

      {/* Two-column form layout */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left column — main form (3/5) */}
          <div className="lg:col-span-3 space-y-5">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Server className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('brain.newIntake.serviceIdentity')}</CardTitle>
                    <CardDescription>{t('brain.newIntake.serviceIdentityDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serviceId">
                      {t('brain.newIntake.serviceId')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="serviceId"
                      placeholder="e.g., procurement_intel"
                      value={formData.serviceId}
                      onChange={(e) => setFormData({ ...formData, serviceId: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                      className="font-mono"
                      disabled={!intakeEnabled}
                    />
                    {formData.serviceId && !serviceIdValid && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {t('brain.newIntake.serviceIdValidation')}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceName">
                      {t('brain.newIntake.displayName')} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="serviceName"
                      placeholder="e.g., Procurement Intelligence"
                      value={formData.serviceName}
                      onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                      disabled={!intakeEnabled}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('brain.newIntake.descriptionLabel')}</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this service does in the demand gateway..."
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={!intakeEnabled}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <Shield className="h-4.5 w-4.5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('brain.newIntake.configuration')}</CardTitle>
                    <CardDescription>{t('brain.newIntake.configurationDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="classification">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5" />
                      {t('brain.newIntake.defaultClassification')}
                    </div>
                  </Label>
                  <Select
                    value={formData.defaultClassification}
                    onValueChange={(val) => setFormData({ ...formData, defaultClassification: val })}
                    disabled={!intakeEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select classification level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="confidential">Confidential</SelectItem>
                      <SelectItem value="sovereign">Sovereign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3.5">
                  <div className="space-y-0.5">
                    <Label className="text-sm">{t('brain.newIntake.activateOnReg')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('brain.newIntake.activateOnRegDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    disabled={!intakeEnabled}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column — preview + submit (2/5) */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">{t('brain.newIntake.preview')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <PreviewRow label="Service ID" value={formData.serviceId || "—"} mono />
                  <PreviewRow label="Name" value={formData.serviceName || "—"} />
                  <PreviewRow label="Description" value={formData.description || "—"} truncate />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Classification</span>
                    <Badge variant="secondary" className="text-xs capitalize">{formData.defaultClassification}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Status</span>
                    {formData.isActive
                      ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pipeline info */}
            <Card className="border-dashed">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-cyan-500" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground text-sm">{t('brain.newIntake.whatNext')}</p>
                    <p>{t('brain.newIntake.whatNextDesc1')}</p>
                    <p>{t('brain.newIntake.whatNextDesc2')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={!intakeEnabled || !isValid || !serviceIdValid || registerMutation.isPending}>
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('brain.newIntake.registering')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('brain.newIntake.registerService')}
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/brain-console/services")}>
                {t('app.cancel')}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function PreviewRow({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className={`text-sm text-right ${mono ? "font-mono" : ""} ${truncate ? "line-clamp-2" : ""} font-medium`}>{value}</span>
    </div>
  );
}
