import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

export function AccessDenied({ reason }: { reason?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-screen p-4" data-testid="access-denied-container">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" data-testid="icon-access-denied" />
            <CardTitle data-testid="text-access-denied-title">{t('auth.accessDenied.title')}</CardTitle>
          </div>
          <CardDescription data-testid="text-access-denied-description">
            {t('auth.accessDenied.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="text-access-denied-reason">
            {reason || t('auth.accessDenied.defaultReason')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
