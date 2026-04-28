import {
  Activity,
  Building2,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
  Star,
  Target,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { WbsTaskData } from '../../../types';

export type AssignedResource = {
  name: string;
  type: 'user' | 'team';
};

export type ResourceAssignmentViewMode = 'suggested' | 'all';

export type ResourceWorkloadSummary = {
  taskCount: number;
  totalHours: number;
};

export type UserResourceOption = {
  id: string;
  type: 'user';
  displayName: string;
  email: string;
  department?: string;
  role?: string;
  matchScore: number;
  workload: ResourceWorkloadSummary;
};

export type TeamResourceOption = {
  id: string;
  type: 'team';
  name: string;
  description?: string;
  matchScore: number;
  workload: ResourceWorkloadSummary;
};

export type ResourceAssignmentOptions = {
  users: UserResourceOption[];
  teams: TeamResourceOption[];
  suggested: Array<UserResourceOption | TeamResourceOption>;
};

type ResourceAssignmentDialogProps = {
  open: boolean;
  task: WbsTaskData | null;
  currentlyAssigned: AssignedResource[];
  selectedResources: string[];
  searchQuery: string;
  viewMode: ResourceAssignmentViewMode;
  filteredResources: ResourceAssignmentOptions;
  isSaving: boolean;
  noSuggestionsText: string;
  noResourcesText: string;
  onOpenChange: (open: boolean) => void;
  onSearchQueryChange: (value: string) => void;
  onViewModeChange: (mode: ResourceAssignmentViewMode) => void;
  onSelectedResourcesChange: (resources: string[]) => void;
  onRemoveAssigned: (resourceName: string) => void;
  onSave: () => void;
};

function resourceRowState(isSelected: boolean, isCurrentlyAssigned: boolean) {
  if (isSelected) return 'border-indigo-500 bg-indigo-500/10';
  if (isCurrentlyAssigned) return 'border-emerald-500/50 bg-emerald-500/5';
  return 'border-border/50 hover:border-indigo-300 hover:bg-muted/50';
}

function matchTone(score: number, high = 80, medium = 60) {
  if (score >= high) return 'bg-emerald-500';
  if (score >= medium) return 'bg-amber-500';
  return high === 80 ? 'bg-red-400' : 'bg-muted-foreground';
}

function matchTextTone(score: number) {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500';
}

function getResourceDisplayName(resource: UserResourceOption | TeamResourceOption) {
  return resource.type === 'user'
    ? (resource.displayName || resource.email || 'User')
    : resource.name;
}

export function ResourceAssignmentDialog({
  open,
  task,
  currentlyAssigned,
  selectedResources,
  searchQuery,
  viewMode,
  filteredResources,
  isSaving,
  noSuggestionsText,
  noResourcesText,
  onOpenChange,
  onSearchQueryChange,
  onViewModeChange,
  onSelectedResourcesChange,
  onRemoveAssigned,
  onSave,
}: ResourceAssignmentDialogProps) {
  const toggleResource = (resourceName: string) => {
    if (selectedResources.includes(resourceName)) {
      onSelectedResourcesChange(selectedResources.filter((resource) => resource !== resourceName));
    } else {
      onSelectedResourcesChange([...selectedResources, resourceName]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span>Smart Resource Assignment</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">Skill-based matching using department & role heuristics</p>
              </div>
            </DialogTitle>
          </div>
          {task && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium">Task:</span>
                <span className="text-sm text-muted-foreground truncate">{task.title || task.taskName}</span>
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-6">{task.description}</p>
              )}
            </div>
          )}
        </DialogHeader>

        {currentlyAssigned.length > 0 && (
          <div className="border-b pb-3">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Currently Assigned</span>
              <Badge variant="secondary" className="text-xs">{currentlyAssigned.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentlyAssigned.map((resource, index) => (
                <div
                  key={`assigned-${resource.name}-${resource.type}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full"
                >
                  {resource.type === 'user' ? (
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-emerald-500 text-white text-xs">
                        {resource.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Building2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{resource.name}</span>
                  <button
                    type="button"
                    className="ml-1 p-1 rounded-full hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    disabled={isSaving}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectedResourcesChange(selectedResources.filter((item) => item !== resource.name));
                      onRemoveAssigned(resource.name);
                    }}
                    data-testid={`remove-resource-${index}`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 hover:text-red-600" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, department, or skill..."
            className="pl-9 bg-muted/30"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            data-testid="resource-search-input"
          />
        </div>

        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={viewMode === 'suggested' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('suggested')}
            className={viewMode === 'suggested' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : ''}
            data-testid="tab-suggested"
          >
            <Lightbulb className="w-4 h-4 mr-1" />
            AI Suggested
            <Badge variant="secondary" className="ml-1.5 text-xs">{filteredResources.suggested.length}</Badge>
          </Button>
          <Button
            variant={viewMode === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('all')}
            data-testid="tab-all"
          >
            <Users className="w-4 h-4 mr-1" />
            All Resources
            <Badge variant="secondary" className="ml-1.5 text-xs">{filteredResources.users.length + filteredResources.teams.length}</Badge>
          </Button>
        </div>

        <ScrollArea className="h-[280px] pr-3">
          <div className="space-y-2">
            {viewMode === 'suggested' ? (
              <>
                {filteredResources.suggested.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{noSuggestionsText}</p>
                    <p className="text-xs mt-1">Try the "All Resources" tab</p>
                  </div>
                ) : (
                  filteredResources.suggested.map((resource, index) => {
                    const isUser = resource.type === 'user';
                    const displayName = getResourceDisplayName(resource);
                    const isSelected = selectedResources.includes(displayName);
                    const isCurrentlyAssigned = currentlyAssigned.some((item) => item.name === displayName);

                    return (
                      <button
                        type="button"
                        key={`${resource.type}-${resource.id}`}
                        className={`text-left w-full flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${resourceRowState(isSelected, isCurrentlyAssigned)}`}
                        onClick={() => toggleResource(displayName)}
                        data-testid={`suggested-resource-${index}`}
                      >
                        <Checkbox checked={isSelected || isCurrentlyAssigned} onCheckedChange={() => {}} />

                        {isUser ? (
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                              {displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{displayName}</span>
                            {resource.matchScore >= 80 && (
                              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 text-xs">
                                <Star className="w-3 h-3 mr-0.5" /> Top Match
                              </Badge>
                            )}
                            {isCurrentlyAssigned && (
                              <Badge className="bg-emerald-500/20 text-emerald-600 text-xs">Assigned</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isUser ? (resource.department || resource.role || resource.email) : (resource.description || 'Team')}
                          </div>

                          <div className="flex items-center gap-4 mt-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">Match:</span>
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${matchTone(resource.matchScore)}`}
                                      style={{ width: `${resource.matchScore}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-medium ${matchTextTone(resource.matchScore)}`}>{resource.matchScore}%</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Heuristic skill match for this task</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  <Activity className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {resource.workload.taskCount} tasks
                                  </span>
                                  {resource.workload.taskCount === 0 && (
                                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/40">Available</Badge>
                                  )}
                                  {resource.workload.taskCount >= 5 && (
                                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/40">Busy</Badge>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div>
                                  <p className="font-medium">Current Workload</p>
                                  <p>{resource.workload.taskCount} tasks assigned</p>
                                  {resource.workload.totalHours > 0 && <p>{resource.workload.totalHours}h estimated</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          className={isSelected ? 'text-indigo-600' : ''}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleResource(displayName);
                          }}
                        >
                          {isSelected ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </Button>
                      </button>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {filteredResources.users.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide sticky top-0 bg-background py-1">
                      <UserCircle className="w-3 h-3" />
                      Team Members ({filteredResources.users.length})
                    </div>
                    {filteredResources.users.map((user) => {
                      const displayName = user.displayName || user.email || 'User';
                      const isSelected = selectedResources.includes(displayName);
                      const isCurrentlyAssigned = currentlyAssigned.some((item) => item.name === displayName);

                      return (
                        <button
                          type="button"
                          key={user.id}
                          className={`text-left w-full flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${resourceRowState(isSelected, isCurrentlyAssigned)}`}
                          onClick={() => toggleResource(displayName)}
                          data-testid={`resource-user-${user.id}`}
                        >
                          <Checkbox checked={isSelected || isCurrentlyAssigned} onCheckedChange={() => {}} />
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">
                              {displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{displayName}</span>
                              {isCurrentlyAssigned && <Badge className="bg-emerald-500/20 text-emerald-600 text-xs">Assigned</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate">{user.department || user.role || user.email}</span>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">{user.workload.taskCount} tasks</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${matchTone(user.matchScore, 70, 50)}`}
                                style={{ width: `${user.matchScore}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-7">{user.matchScore}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredResources.teams.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide sticky top-0 bg-background py-1">
                      <Building2 className="w-3 h-3" />
                      Teams ({filteredResources.teams.length})
                    </div>
                    {filteredResources.teams.map((team) => {
                      const isSelected = selectedResources.includes(team.name);
                      const isCurrentlyAssigned = currentlyAssigned.some((item) => item.name === team.name);

                      return (
                        <button
                          type="button"
                          key={team.id}
                          className={`text-left w-full flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${resourceRowState(isSelected, isCurrentlyAssigned)}`}
                          onClick={() => toggleResource(team.name)}
                          data-testid={`resource-team-${team.id}`}
                        >
                          <Checkbox checked={isSelected || isCurrentlyAssigned} onCheckedChange={() => {}} />
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{team.name}</span>
                              {isCurrentlyAssigned && <Badge className="bg-emerald-500/20 text-emerald-600 text-xs">Assigned</Badge>}
                            </div>
                            {team.description && (
                              <div className="text-xs text-muted-foreground truncate">{team.description}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${matchTone(team.matchScore, 70, 50)}`}
                                style={{ width: `${team.matchScore}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-7">{team.matchScore}%</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {filteredResources.users.length === 0 && filteredResources.teams.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{noResourcesText}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {selectedResources.length > 0 && (
          <div className="pt-3 border-t bg-muted/30 -mx-6 px-6 -mb-6 pb-4 rounded-b-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium">New Assignments</span>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">{selectedResources.length} selected</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedResources.map((resource) => (
                <Badge
                  key={resource}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/20"
                  onClick={() => onSelectedResourcesChange(selectedResources.filter((item) => item !== resource))}
                >
                  {resource}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || (selectedResources.length === 0 && currentlyAssigned.length === 0)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            <UserCheck className="w-4 h-4 mr-1" />
            Save Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
