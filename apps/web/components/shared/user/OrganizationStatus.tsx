import { useTranslation } from 'react-i18next';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, HelpCircle, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthorization } from "@/hooks/useAuthorization";

export default function OrganizationStatus() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { canAccess: canAccessIntegrationHub } = useAuthorization({ requiredPermissions: ["integration:hub:view"] });

  if (!canAccessIntegrationHub) {
    return null;
  }

  return (
    <Card className="border-destructive/20 bg-destructive/5" data-testid="card-organization-status">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {t('dashboard.orgStatus.notConnected')}
                </p>
                <Badge variant="destructive" className="text-[11px]" data-testid="status-authentication">
                  {t('dashboard.orgStatus.authRequired')}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground max-w-3xl">
                {t('dashboard.orgStatus.pleaseAuthenticate')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:pt-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-help-organization">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2 text-xs"
              onClick={() => setLocation("/integration-hub")}
              data-testid="button-connect-organization"
            >
              <Building2 className="h-3 w-3" />
              {t('dashboard.orgStatus.connectOrganization')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}