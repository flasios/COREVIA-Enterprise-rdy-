import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  User,
  Calendar,
  Hash,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileSignature
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from 'react-i18next';

interface VersionSignatureStatusProps {
  reportId: string;
  versionId: string;
  versionNumber: string;
  versionStatus: string;
  userRole: string;
}

interface SignatureMetadata {
  signedByName?: string;
  signedByRole?: string;
  signedAt?: string | number | Date;
  contentHash?: string;
  algorithm?: string;
}

interface SignatureVerificationResult {
  isValid?: boolean;
  details?: string;
  signatureValid?: boolean;
  contentHashMatch?: boolean;
}

interface SignatureVerificationData {
  isSigned: boolean;
  signature?: SignatureMetadata;
  verification?: SignatureVerificationResult;
  versionNumber?: number;
  message?: string;
}

interface SignatureVerificationResponse {
  success: boolean;
  data?: SignatureVerificationData;
}

export function VersionSignatureStatus({
  reportId,
  versionId,
  versionNumber,
  versionStatus,
  userRole,
}: VersionSignatureStatusProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [showSignDialog, setShowSignDialog] = useState(false);

  // Fetch signature verification status
  const { data: verificationData, isLoading: isLoadingVerification, refetch } = useQuery<SignatureVerificationResponse>({
    queryKey: ['/api/demand-reports', reportId, 'versions', versionId, 'verify'],
    refetchInterval: 60000, // Refresh every minute
  });

  const verification = verificationData?.data;
  const isSigned = verification?.isSigned || false;
  const signature = verification?.signature;
  const verificationResult = verification?.verification;
  const signedAtDate = signature?.signedAt ? new Date(signature.signedAt) : null;
  const signedAtLabel = signedAtDate && !Number.isNaN(signedAtDate.getTime())
    ? format(signedAtDate, 'PPpp')
    : 'Unknown date';
  const verificationDetails = typeof verificationResult?.details === 'string'
    ? verificationResult.details
    : 'Signature verified';
  const contentHash = typeof signature?.contentHash === 'string' ? signature.contentHash : '';

  // Sign version mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "POST",
        `/api/demand-reports/${reportId}/versions/${versionId}/sign`
      );
    },
    onSuccess: () => {
      toast({
        title: t('versioning.signatureStatus.signedSuccessfully'),
        description: t('versioning.signatureStatus.signedSuccessfullyDesc', { version: versionNumber }),
      });
      setShowSignDialog(false);
      refetch();
      queryClient.invalidateQueries({
        queryKey: ['/api/demand-reports', reportId, 'versions', versionId, 'audit-trail']
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : t('versioning.signatureStatus.failedToSign');
      toast({
        title: t('versioning.signatureStatus.signatureFailed'),
        description: message,
        variant: "destructive",
      });
    },
  });

  // Check if user can sign (directors and managers only)
  const canSign = userRole === 'director' || userRole === 'manager';
  
  // Check if version can be signed (must be approved or published)
  const canBeSigned = versionStatus === 'approved' || versionStatus === 'published';

  if (isLoadingVerification) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('versioning.signatureStatus.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="card-signature-status">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('versioning.signatureStatus.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isSigned ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ShieldOff className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('versioning.signatureStatus.notSigned')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('versioning.signatureStatus.notSignedDesc')}
                  </p>
                </div>
              </div>

              {canSign && canBeSigned && (
                <Button
                  onClick={() => setShowSignDialog(true)}
                  className="w-full"
                  data-testid="button-sign-version"
                >
                  <FileSignature className="h-4 w-4 mr-2" />
                  {t('versioning.signatureStatus.signVersion')}
                </Button>
              )}

              {canSign && !canBeSigned && (
                <div className="rounded-md bg-muted p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {t('versioning.signatureStatus.mustBeApproved')}
                    </p>
                  </div>
                </div>
              )}

              {!canSign && (
                <div className="rounded-md bg-muted p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {t('versioning.signatureStatus.onlyDirectors')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Verification Status */}
              <div className="flex items-start gap-3">
                {verificationResult?.isValid ? (
                  <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-destructive mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge
                      variant={verificationResult?.isValid ? "default" : "destructive"}
                      className={verificationResult?.isValid ? "bg-emerald-600" : ""}
                      data-testid="badge-verification-status"
                    >
                      {verificationResult?.isValid ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('versioning.signatureStatus.verified')}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          {t('versioning.signatureStatus.invalid')}
                        </>
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">
                    {verificationDetails}
                  </p>
                </div>
              </div>

              {/* Signature Details */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{t('versioning.signatureStatus.signedBy')}</p>
                    <p className="text-sm font-medium" data-testid="text-signed-by">
                      {signature?.signedByName || 'Unknown'}
                      {signature?.signedByRole && (
                        <span className="ml-1 text-muted-foreground">
                          ({signature.signedByRole})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{t('versioning.signatureStatus.signedOn')}</p>
                    <p className="text-sm font-medium" data-testid="text-signed-at">
                      {signedAtLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{t('versioning.signatureStatus.contentHash')}</p>
                    <p className="text-xs font-mono break-all text-muted-foreground">
                      {contentHash ? `${contentHash.substring(0, 32)}...` : t('versioning.signatureStatus.unavailable')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{t('versioning.signatureStatus.algorithm')}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {signature?.algorithm || 'HMAC-SHA256'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Warning if verification failed */}
              {!verificationResult?.isValid && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">
                        {t('versioning.signatureStatus.verificationFailed')}
                      </p>
                      <p className="text-xs text-destructive/80 mt-1">
                        {!verificationResult?.contentHashMatch &&
                          t('versioning.signatureStatus.contentModified')}
                        {!verificationResult?.signatureValid &&
                          t('versioning.signatureStatus.signatureInvalid')}
                        {t('versioning.signatureStatus.mayBeTampered')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign Confirmation Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('versioning.signatureStatus.signVersionTitle', { version: versionNumber })}
            </DialogTitle>
            <DialogDescription>
              {t('versioning.signatureStatus.signVersionDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md bg-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{t('versioning.signatureStatus.hashWillBeGenerated')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{t('versioning.signatureStatus.signatureWillBeCreated')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{t('versioning.signatureStatus.auditTrailUpdated')}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSignDialog(false)}
              disabled={signMutation.isPending}
              data-testid="button-cancel-sign"
            >
              {t('versioning.signatureStatus.cancel')}
            </Button>
            <Button
              onClick={() => signMutation.mutate()}
              disabled={signMutation.isPending}
              data-testid="button-confirm-sign"
            >
              {signMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('versioning.signatureStatus.signing')}
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4 mr-2" />
                  {t('versioning.signatureStatus.signVersion')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VersionSignatureStatus;
