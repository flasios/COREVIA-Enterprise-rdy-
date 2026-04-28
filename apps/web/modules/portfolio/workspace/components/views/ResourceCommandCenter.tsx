import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Zap,
  Users,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Briefcase,
  RefreshCw,
  Bell,
  Send,
  UserPlus,
} from "lucide-react";
import type { ProjectData, BusinessCaseData } from "../../types";

interface AvailablePM {
  id: string;
  displayName: string;
  email: string;
  department?: string;
  role: string;
  currentProjects: number;
  maxProjects: number;
  expertise: string[];
  availability: number;
  certifications: string[];
  matchScore?: number;
}

interface ResourceCommandCenterProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  onAssignPM: (pmId: string) => void;
}

export function ResourceCommandCenter({ 
  project,
   
  businessCase: _businessCase,
  onAssignPM,
}: ResourceCommandCenterProps) {
  const [selectedPM, setSelectedPM] = useState<string | null>(null);
  const { t } = useTranslation();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [assignmentNote, setAssignmentNote] = useState('');
  
  const { data: availablePMs = [], isLoading } = useQuery<AvailablePM[]>({
    queryKey: ['/api/users/available-project-managers'],
  });

  const calculateMatchScore = (pm: AvailablePM): number => {
    let score = 0;
    
    const availabilityScore = pm.availability * 0.4;
    score += availabilityScore;
    
    const capacityRatio = pm.maxProjects > 0 ? (pm.maxProjects - pm.currentProjects) / pm.maxProjects : 0;
    score += capacityRatio * 30;
    
    const projectType = project.projectType?.toLowerCase() || '';
    const matchingExpertise = pm.expertise?.filter(e => 
      projectType.includes(e.toLowerCase()) || 
      e.toLowerCase().includes('transformation') ||
      e.toLowerCase().includes('digital')
    ).length || 0;
    score += Math.min(matchingExpertise * 10, 30);
    
    return Math.round(score);
  };

  const pmsWithScores = availablePMs.map(pm => ({
    ...pm,
    matchScore: calculateMatchScore(pm)
  })).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  const getCapacityColor = (current: number, max: number) => {
    const ratio = current / max;
    if (ratio >= 0.9) return 'bg-red-500';
    if (ratio >= 0.7) return 'bg-amber-500';
    if (ratio >= 0.5) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getMatchBadgeStyle = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40';
    if (score >= 60) return 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40';
    if (score >= 40) return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40';
    return 'bg-muted/20 text-muted-foreground border-border/40';
  };

  const handleAssignment = () => {
    if (selectedPM) {
      onAssignPM(selectedPM);
      setShowConfirmDialog(false);
      setSelectedPM(null);
      setAssignmentNote('');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-card/60 border-border">
          <CardContent className="p-12 text-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-muted/50 rounded-full" />
              <div className="h-4 w-48 bg-muted/50 rounded" />
              <div className="h-3 w-32 bg-muted/50 rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Resource Command</h3>
            <p className="text-xs text-muted-foreground">PM matching & assignment</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/40 text-[10px] px-1.5 py-0">
            <Users className="w-2.5 h-2.5 mr-1" />
            {availablePMs.length} PMs
          </Badge>
          {project.projectManagerId && (
            <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 text-[10px] px-1.5 py-0">
              <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
              Assigned
            </Badge>
          )}
        </div>
      </div>

      {project.projectManagerId ? (
        <Card className="bg-emerald-900/20 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg font-bold text-white">
                  PM
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Assigned Project Manager</div>
                  <div className="font-semibold text-lg">Project Manager Assigned</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">Active</Badge>
                <Button variant="outline" size="sm" className="text-muted-foreground" data-testid="button-change-pm">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reassign
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-amber-900/20 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-medium text-amber-600 dark:text-amber-400">Project Manager Required</div>
                <div className="text-sm text-muted-foreground">Select a project manager from the available pool below to proceed with initiation</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pmsWithScores.length > 0 && !project.projectManagerId && (
        <Card className="bg-gradient-to-br from-purple-50 to-background dark:from-purple-900/20 dark:to-slate-900/60 border-purple-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              AI-Recommended Matches
            </CardTitle>
            <p className="text-sm text-muted-foreground">Based on project requirements, expertise, and availability</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pmsWithScores.slice(0, 3).map((pm, index) => (
                <div
                  key={pm.id}
                  onClick={() => { setSelectedPM(pm.id); setShowConfirmDialog(true); }}
                  className={`relative p-4 rounded-xl border cursor-pointer transition-all hover-elevate ${
                    index === 0 
                      ? 'bg-gradient-to-br from-emerald-100 to-background dark:from-emerald-900/30 dark:to-slate-900/60 border-emerald-500/40' 
                      : 'bg-muted/40 border-border/50'
                  }`}
                  data-testid={`card-pm-recommendation-${index}`}
                >
                  {index === 0 && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="bg-emerald-500 text-white text-[10px] px-2">
                        Best Match
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      index === 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
                      index === 1 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                      'bg-gradient-to-br from-purple-500 to-pink-600'
                    }`}>
                      {pm.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{pm.displayName}</div>
                      <div className="text-xs text-muted-foreground">{pm.department || pm.role}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge className={`text-xs ${getMatchBadgeStyle(pm.matchScore || 0)}`}>
                      {pm.matchScore}% Match
                    </Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="w-3 h-3" />
                      {pm.currentProjects}/{pm.maxProjects}
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-[10px] text-muted-foreground/70 mb-1">Capacity</div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${getCapacityColor(pm.currentProjects, pm.maxProjects)} transition-all`}
                        style={{ width: `${(pm.currentProjects / pm.maxProjects) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card/60 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Available Resource Pool
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>High Availability</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Low</span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {pmsWithScores.map((pm) => (
                <div
                  key={pm.id}
                  className="p-4 bg-muted/40 border border-border/50 rounded-lg hover-elevate transition-all"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                          {pm.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
                          pm.availability >= 70 ? 'bg-emerald-500' :
                          pm.availability >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                      </div>
                      <div>
                        <div className="font-medium">{pm.displayName}</div>
                        <div className="text-sm text-muted-foreground">{pm.department || pm.role}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pm.expertise?.slice(0, 3).map((exp, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-muted/50">
                              {exp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Workload</div>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${getCapacityColor(pm.currentProjects, pm.maxProjects)}`}
                              style={{ width: `${(pm.currentProjects / pm.maxProjects) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono">{pm.currentProjects}/{pm.maxProjects}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Match</div>
                        <Badge className={`text-xs ${getMatchBadgeStyle(pm.matchScore || 0)}`}>
                          {pm.matchScore}%
                        </Badge>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => { setSelectedPM(pm.id); setShowConfirmDialog(true); }}
                        disabled={pm.currentProjects >= pm.maxProjects}
                        data-testid={`button-assign-pm-${pm.id}`}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {pmsWithScores.length === 0 && (
                <div className="text-center py-12 text-muted-foreground/70">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>{t('projectWorkspace.resources.noManagersFound')}</p>
                  <p className="text-sm mt-1">All managers may be at capacity or unavailable</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Confirm Project Manager Assignment
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedPM && (
              <div className="space-y-4">
                <div className="p-4 bg-muted/60 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                      {pmsWithScores.find(p => p.id === selectedPM)?.displayName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium">{pmsWithScores.find(p => p.id === selectedPM)?.displayName}</div>
                      <div className="text-sm text-muted-foreground">{pmsWithScores.find(p => p.id === selectedPM)?.email}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Assignment Note (Optional)</label>
                  <textarea
                    value={assignmentNote}
                    onChange={(e) => setAssignmentNote(e.target.value)}
                    placeholder={t('projectWorkspace.resources.specialInstructions')}
                    className="w-full h-24 bg-muted/60 border border-border rounded-lg p-3 text-sm resize-none"
                    data-testid="input-assignment-note"
                  />
                </div>
                <div className="flex items-center gap-2 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm text-foreground/80">The selected PM will receive an automatic notification</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignment} className="gap-2" data-testid="button-confirm-assignment">
              <Send className="w-4 h-4" />
              Assign & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
