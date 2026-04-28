import { Badge } from "@/components/ui/badge";
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="flex items-center justify-center px-6 py-4 border-t bg-background mt-8">
      <Badge variant="secondary" className="text-xs" data-testid="status-system">
        <div className="h-2 w-2 bg-chart-2 rounded-full mr-2"></div>
        {t('app.systemOperational', 'System Operational')}
      </Badge>
    </footer>
  );
}