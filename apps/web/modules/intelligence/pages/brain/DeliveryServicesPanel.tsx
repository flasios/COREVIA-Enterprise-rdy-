import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WhatsAppStatus = {
  available?: boolean;
  sendCount?: number;
  lastError?: string | null;
};

type WhatsAppConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  apiVersion?: string;
  templateName?: string;
  templateLanguage?: string;
};

export function DeliveryServicesPanel() {
  const { t } = useTranslation();
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [_waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    accessToken: "",
    phoneNumberId: "",
    apiVersion: "v21.0",
    templateName: "corevia_notification",
    templateLanguage: "en",
  });

  useEffect(() => {
    setLoading(true);
    fetch("/api/notification-orchestrator/whatsapp/status")
      .then((r) => r.json())
      .then((data) => {
        setWaStatus((data?.data as WhatsAppStatus) || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    fetch("/api/notification-orchestrator/whatsapp/config")
      .then((r) => r.json())
      .then((data) => {
        const config = (data?.data as WhatsAppConfig) || null;
        setWaConfig(config);
        if (config) {
          setForm((prev) => ({ ...prev, ...config }));
        }
       
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/notification-orchestrator/whatsapp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/notification-orchestrator/whatsapp/config"] });
      toast({ title: "Configuration saved", description: "WhatsApp configuration updated successfully." });
    } catch {
      toast({ title: "Save failed", description: "Failed to save WhatsApp configuration.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 flex items-center gap-6">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900">
          <MessageCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-300" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{t('brain.deliveryServices.whatsappTitle')}</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> {t('brain.deliveryServices.checkingStatus')}</div>
          ) : waStatus?.available ? (
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs bg-emerald-500 text-white">{t('brain.deliveryServices.active')}</Badge>
              <span className="text-xs text-muted-foreground">{t('brain.deliveryServices.messagesSent', { count: waStatus.sendCount })}</span>
              {waStatus.lastError && <span className="text-xs text-red-500">{t('brain.deliveryServices.lastError', { error: waStatus.lastError })}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="text-xs">{t('brain.deliveryServices.notConfigured')}</Badge>
              <span className="text-xs text-muted-foreground">{t('brain.deliveryServices.configureBelow')}</span>
            </div>
          )}
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="text-base font-semibold mb-2">{t('brain.deliveryServices.whatsappConfig')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">{t('brain.deliveryServices.accessToken')}</label>
            <input name="accessToken" value={form.accessToken} onChange={handleChange} className="w-full border rounded px-2 py-1 text-xs" type="password" autoComplete="off" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t('brain.deliveryServices.phoneNumberId')}</label>
            <input name="phoneNumberId" value={form.phoneNumberId} onChange={handleChange} className="w-full border rounded px-2 py-1 text-xs" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t('brain.deliveryServices.apiVersion')}</label>
            <input name="apiVersion" value={form.apiVersion} onChange={handleChange} className="w-full border rounded px-2 py-1 text-xs" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t('brain.deliveryServices.templateName')}</label>
            <input name="templateName" value={form.templateName} onChange={handleChange} className="w-full border rounded px-2 py-1 text-xs" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t('brain.deliveryServices.templateLanguage')}</label>
            <input name="templateLanguage" value={form.templateLanguage} onChange={handleChange} className="w-full border rounded px-2 py-1 text-xs" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded font-medium text-xs">
          {saving ? t('brain.deliveryServices.saving') : t('brain.deliveryServices.saveConfig')}
        </button>
      </Card>
    </div>
  );
}
