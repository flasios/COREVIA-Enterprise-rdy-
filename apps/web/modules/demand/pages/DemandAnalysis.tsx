import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";
import { Link } from "wouter";
import { DemandWizardEnhanced } from "@/modules/demand/components";
import { useTranslation } from 'react-i18next';

export default function DemandAnalysis() {
  const { t } = useTranslation();
  return (
    <div className="h-screen bg-background constellation-grid relative overflow-hidden">
      <div className="w-full px-6 relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 py-4">
          <div className="flex items-center gap-4">
            <Link href="/intelligent-gateway">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-back-gateway">
                <ArrowLeft className="h-4 w-4" />
                {t('app.back')}
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">{t('demand.wizard.intelligenceDemandRequest')}</h1>
              <p className="text-sm text-muted-foreground">{t('demand.wizard.intelligentGovernmentAnalysis')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold tracking-wide">
              <Shield className="h-3.5 w-3.5" />
              {t('demand.productHome.aiAnalysis')}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden min-h-0 pb-4">
          <DemandWizardEnhanced />
        </div>
      </div>
    </div>
  );
}