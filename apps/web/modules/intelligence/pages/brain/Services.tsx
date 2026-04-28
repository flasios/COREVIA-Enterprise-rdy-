import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import {
  Server,
  Plus,
  Shield,
  Activity,
} from "lucide-react";
import { fetchControlPlane, fetchServices, setIntakeGate, toggleService } from "@/api/brain";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ServiceItem {
  serviceId: string;
  name: string;
  description: string;
  enabled: boolean;
  version: string;
  classification?: string;
  registeredAt?: string | null;
}


export function Services() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  const { data: controlPlaneData } = useQuery({
    queryKey: ["control-plane"],
    queryFn: fetchControlPlane,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ serviceId, isActive }: { serviceId: string; isActive: boolean }) =>
      toggleService(serviceId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: t('brain.services.statusUpdated') });
    },
    onError: () => {
      toast({ title: t('brain.services.updateFailed'), variant: "destructive" });
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => setIntakeGate(enabled),
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["control-plane"] });
      toast({ title: enabled ? t('brain.services.intakeEnabled') : t('brain.services.intakePaused') });
    },
    onError: () => {
      toast({ title: t('brain.services.intakeUpdateFailed'), variant: "destructive" });
    },
  });

  const services: ServiceItem[] = data?.services || [];

  const activeCount = services.filter(s => s.enabled).length;
  const totalCount = services.length;
  const allEnabled = controlPlaneData?.state?.intakeEnabled ?? (totalCount > 0 && activeCount === totalCount);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,hsl(var(--brain-console-ice))_0%,hsl(var(--brain-surface))_55%,hsl(var(--brain-console-ash))_100%)] p-6">
        <div className="absolute right-0 top-0 h-32 w-32 translate-x-10 -translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-copper)/0.2)_0%,transparent_70%)]" />
        <div className="absolute left-0 bottom-0 h-36 w-36 -translate-x-12 translate-y-10 rounded-full bg-[radial-gradient(circle,hsl(var(--brain-console-teal)/0.2)_0%,transparent_70%)]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-overline text-muted-foreground">{t('brain.services.controlPlane')}</p>
            <h1 className="text-2xl font-bold">{t('brain.services.title')}</h1>
            <p className="text-muted-foreground">
              {t('brain.services.description')}
            </p>
          </div>
          <Link href="/brain-console/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('brain.services.registerNew')}
            </Button>
          </Link>
        </div>
      </section>

      <Card className="executive-panel">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">{t('brain.services.globalIntakeGate')}</p>
              <p className="text-lg font-semibold">{allEnabled ? t('brain.services.open') : t('brain.services.paused')}</p>
              <p className="text-xs text-muted-foreground">{t('brain.services.toggleAll')}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={allEnabled}
                onCheckedChange={(checked) => bulkToggleMutation.mutate(checked)}
                disabled={isLoading || bulkToggleMutation.isPending || totalCount === 0}
              />
              <Badge className={allEnabled ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-amber-500/10 text-amber-700 border-amber-500/30"}>
                {allEnabled ? t('brain.services.intakeEnabledLabel') : t('brain.services.intakePausedLabel')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.services.totalPlugins')}</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.services.active')}</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('brain.services.inactive')}</p>
                <p className="text-2xl font-bold">{totalCount - activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('brain.services.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">{t('brain.services.serviceId')}</TableHead>
                  <TableHead>{t('brain.services.name')}</TableHead>
                  <TableHead>{t('brain.services.descriptionLabel')}</TableHead>
                  <TableHead className="w-[100px] text-center">{t('brain.services.version')}</TableHead>
                  <TableHead className="w-[120px] text-center">{t('brain.services.classification')}</TableHead>
                  <TableHead className="w-[100px] text-center">{t('brain.services.enabled')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.serviceId}>
                    <TableCell className="font-mono text-sm">{service.serviceId}</TableCell>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{service.description}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono text-xs">
                        {service.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {service.classification || "internal"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={service.enabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ serviceId: service.serviceId, isActive: checked })
                          }
                          disabled={toggleMutation.isPending}
                        />
                        {service.enabled ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            YES
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            NO
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
