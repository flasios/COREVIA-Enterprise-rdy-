import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Trophy, Medal, Award } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface DocumentQuality {
  documentId: string;
  filename: string;
  qualityScore: number;
  citationCount: number;
  usageCount: number;
  avgRelevance: number;
  recencyScore: number;
}

interface DocumentLeaderboardProps {
  documents: DocumentQuality[];
  sortBy?: string;
}

export function DocumentLeaderboard({ documents, sortBy: _sortBy = 'quality' }: DocumentLeaderboardProps) {
  const { t } = useTranslation();

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (index === 1) return <Medal className="h-4 w-4 text-gray-400" />;
    if (index === 2) return <Award className="h-4 w-4 text-amber-600" />;
    return <span className="text-sm text-muted-foreground">{index + 1}</span>;
  };

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return "default";
    if (score >= 0.6) return "secondary";
    return "outline";
  };

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center" data-testid="empty-leaderboard">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">{t('analytics.leaderboard.noDocuments')}</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[400px]" data-testid="document-leaderboard">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">{t('analytics.leaderboard.rank')}</TableHead>
            <TableHead>{t('analytics.leaderboard.document')}</TableHead>
            <TableHead className="text-right">{t('analytics.leaderboard.quality')}</TableHead>
            <TableHead className="text-right">{t('analytics.leaderboard.citations')}</TableHead>
            <TableHead className="text-right">{t('analytics.leaderboard.usage')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc, index) => (
            <TableRow key={doc.documentId} data-testid={`doc-row-${doc.documentId}`}>
              <TableCell className="font-medium">
                <div className="flex items-center justify-center">
                  {getRankIcon(index)}
                </div>
              </TableCell>
              <TableCell className="max-w-[300px] truncate" title={doc.filename}>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{doc.filename}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={getQualityColor(doc.qualityScore)}>
                  {(doc.qualityScore * 100).toFixed(0)}%
                </Badge>
              </TableCell>
              <TableCell className="text-right">{doc.citationCount}</TableCell>
              <TableCell className="text-right">{doc.usageCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
