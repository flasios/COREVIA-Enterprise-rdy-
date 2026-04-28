import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GatewayLayout } from '@/components/layout';
import { FileText, LayoutDashboard, FilePlus, Bell, Calendar } from 'lucide-react';
import { OverviewTab, DocumentsTab, GenerateTab, TenderPreview } from './tenderGateway.tabs';

export default function TenderGateway() {
  const [, _navigate] = useLocation();
  const [, params] = useRoute('/tenders/:id');
  const tenderId = params?.id;

  if (tenderId) {
    return <TenderPreview tenderId={tenderId} />;
  }

  return <TenderGatewayDashboard />;
}

function TenderGatewayDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <GatewayLayout
      title={t('compliance.tenderDocumentGateway')}
      subtitle={t('compliance.tenderSubtitle')}
      icon={<FileText className="w-7 h-7 text-white" />}
      accentColor="indigo"
      testId="gateway-tender"
      headerActions={
        <>
          <Button variant="outline" size="sm" className="gap-2">
            <Bell className="w-4 h-4" />
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">3</Badge>
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="w-4 h-4" />
            {t('compliance.deadlines')}
          </Button>
        </>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <LayoutDashboard className="w-4 h-4" />
            {t('app.overview')}
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
            <FileText className="w-4 h-4" />
            {t('compliance.rfpDocuments')}
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2" data-testid="tab-generate">
            <FilePlus className="w-4 h-4" />
            {t('compliance.generateNew')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <DocumentsTab />
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <GenerateTab />
        </TabsContent>
      </Tabs>
    </GatewayLayout>
  );
}
