import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  Plus, 
  BarChart3, 
  MessageSquare, 
  Mail,
  ArrowUp,
  ArrowRight 
} from 'lucide-react';
import { StakeholderData } from '../../types';

interface StakeholdersTabProps {
  stakeholders: StakeholderData[];
  onAddStakeholder: () => void;
}

const stakeholderTypeColors: Record<string, string> = {
  sponsor: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  champion: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  key_user: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  decision_maker: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  influencer: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
  affected_party: 'bg-muted/50 text-muted-foreground',
};

const engagementColors: Record<string, string> = {
  supportive: 'text-emerald-600 dark:text-emerald-400',
  neutral: 'text-muted-foreground',
  resistant: 'text-red-600 dark:text-red-400',
  unaware: 'text-blue-600 dark:text-blue-400',
};

const matrixQuadrants = [
  { influence: 'high', interest: 'high', label: 'Manage Closely', color: 'bg-red-900/30 border-red-700/50', strategy: 'Key players - engage actively' },
  { influence: 'high', interest: 'low', label: 'Keep Satisfied', color: 'bg-amber-900/30 border-amber-700/50', strategy: 'Keep informed of major decisions' },
  { influence: 'low', interest: 'high', label: 'Keep Informed', color: 'bg-blue-900/30 border-blue-700/50', strategy: 'Regular communication, address concerns' },
  { influence: 'low', interest: 'low', label: 'Monitor', color: 'bg-muted/50 border-border/50', strategy: 'Minimal effort, periodic updates' },
];

export function StakeholdersTab({ stakeholders, onAddStakeholder }: StakeholdersTabProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');

  const stakeholderStats = {
    total: stakeholders.length,
    sponsors: stakeholders.filter(s => s.stakeholderType === 'sponsor').length,
    decisionMakers: stakeholders.filter(s => s.stakeholderType === 'decision_maker').length,
    highInfluence: stakeholders.filter(s => s.influenceLevel === 'high').length,
    highInterest: stakeholders.filter(s => s.interestLevel === 'high').length,
  };

  const getMatrixQuadrant = (influence: string, interest: string) => {
    return stakeholders.filter(s => 
      s.influenceLevel === influence && s.interestLevel === interest
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-card/60 border-border p-3">
          <div className="text-xl font-bold text-foreground">{stakeholderStats.total}</div>
          <div className="text-xs text-muted-foreground">Total Stakeholders</div>
        </Card>
        <Card className="bg-purple-900/20 border-purple-800/30 p-3">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{stakeholderStats.sponsors}</div>
          <div className="text-xs text-muted-foreground">Sponsors</div>
        </Card>
        <Card className="bg-amber-900/20 border-amber-800/30 p-3">
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{stakeholderStats.decisionMakers}</div>
          <div className="text-xs text-muted-foreground">Decision Makers</div>
        </Card>
        <Card className="bg-red-900/20 border-red-800/30 p-3">
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{stakeholderStats.highInfluence}</div>
          <div className="text-xs text-muted-foreground">High Influence</div>
        </Card>
        <Card className="bg-blue-900/20 border-blue-800/30 p-3">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stakeholderStats.highInterest}</div>
          <div className="text-xs text-muted-foreground">High Interest</div>
        </Card>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Stakeholder Registry</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Manage stakeholder relationships and engagement strategies</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
              <Button 
                size="sm" 
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                className="rounded-none gap-1"
                onClick={() => setViewMode('cards')}
                data-testid="button-view-cards"
              >
                <Users className="w-3 h-3" />
                Cards
              </Button>
              <Button 
                size="sm" 
                variant={viewMode === 'matrix' ? 'default' : 'ghost'}
                className="rounded-none gap-1"
                onClick={() => setViewMode('matrix')}
                data-testid="button-view-matrix-stakeholder"
              >
                <BarChart3 className="w-3 h-3" />
                Matrix
              </Button>
            </div>
            <Button size="sm" className="gap-2" onClick={onAddStakeholder} data-testid="button-add-stakeholder">
              <Plus className="w-4 h-4" />
              Add Stakeholder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'matrix' ? (
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground mb-4">
                Influence/Interest Matrix - Stakeholder Engagement Strategy
              </div>
              <div className="grid grid-cols-2 gap-4">
                {matrixQuadrants.map((quadrant) => {
                  const quadrantStakeholders = getMatrixQuadrant(quadrant.influence, quadrant.interest);
                  return (
                    <div 
                      key={`${quadrant.influence}-${quadrant.interest}`}
                      className={`p-4 rounded-lg border ${quadrant.color} min-h-[200px]`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium text-foreground">{quadrant.label}</div>
                          <div className="text-xs text-muted-foreground">{quadrant.strategy}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {quadrantStakeholders.length}
                        </Badge>
                      </div>
                      <ScrollArea className="h-[140px]">
                        <div className="space-y-2">
                          {quadrantStakeholders.map(s => (
                            <div key={s.id} className="flex items-center gap-2 p-2 bg-card/50 rounded">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                {s.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{s.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{s.title}</div>
                              </div>
                              <Badge className={`text-xs ${stakeholderTypeColors[s.stakeholderType] || ''}`}>
                                {s.stakeholderType?.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          ))}
                          {!quadrantStakeholders.length && (
                            <div className="text-center text-xs text-muted-foreground/70 py-4">
                              No stakeholders in this quadrant
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ArrowUp className="w-3 h-3" />
                  <span>High Influence</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-3 h-3" />
                  <span>High Interest</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stakeholders.map((stakeholder) => (
                <div 
                  key={stakeholder.id}
                  className="p-4 bg-muted/40 border border-border/50 rounded-lg hover-elevate"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {stakeholder.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{stakeholder.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{stakeholder.title}</div>
                      <div className="text-xs text-muted-foreground/70 truncate">{stakeholder.organization}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge className={stakeholderTypeColors[stakeholder.stakeholderType] || ''}>
                      {stakeholder.stakeholderType?.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Influence: {stakeholder.influenceLevel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Interest: {stakeholder.interestLevel}
                    </Badge>
                  </div>
                  {stakeholder.engagementLevel && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground/70">Engagement:</span>
                      <span className={engagementColors[stakeholder.engagementLevel] || 'text-muted-foreground'}>
                        {stakeholder.engagementLevel}
                      </span>
                    </div>
                  )}
                  {stakeholder.communicationFrequency && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" />
                      <span>Comm: {stakeholder.communicationFrequency}</span>
                    </div>
                  )}
                  {stakeholder.email && (
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {stakeholder.email}
                    </div>
                  )}
                </div>
              ))}
              {!stakeholders.length && (
                <div className="col-span-full text-center text-muted-foreground/70 py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{t('projectWorkspace.stakeholders.noStakeholders')}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-4"
                    onClick={onAddStakeholder}
                    data-testid="button-add-first-stakeholder"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Stakeholder
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
