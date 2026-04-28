import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Bell,
  FileText,
  BarChart3,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  Plus,
  CalendarDays,
  Users,
  Mail,
  type LucideIcon,
} from 'lucide-react';

import type { CommunicationData } from '../../types';
import { priorityColors, statusColors } from '../../utils';

interface CommunicationsTabProps {
  communications: CommunicationData[];
}

export function CommunicationsTab({ communications }: CommunicationsTabProps) {
  const [filterType, setFilterType] = useState('all');

  const commTypeIcons: Record<string, LucideIcon> = {
    announcement: Bell,
    meeting_minutes: FileText,
    status_report: BarChart3,
    decision: CheckCircle2,
    action_item: ListTodo,
    general: MessageSquare,
  };

  const commTypeColors: Record<string, string> = {
    announcement: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    meeting_minutes: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    status_report: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    decision: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
    action_item: 'bg-red-500/20 text-red-600 dark:text-red-400',
    general: 'bg-muted/50 text-muted-foreground',
  };

  const filteredComms = communications.filter(comm =>
    filterType === 'all' || comm.communicationType === filterType
  );

  const commStats = {
    total: communications.length,
    announcements: communications.filter(c => c.communicationType === 'announcement').length,
    meetings: communications.filter(c => c.communicationType === 'meeting_minutes').length,
    decisions: communications.filter(c => c.communicationType === 'decision').length,
    actions: communications.filter(c => c.communicationType === 'action_item').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-card/60 border-border p-3">
          <div className="text-xl font-bold text-foreground">{commStats.total}</div>
          <div className="text-xs text-muted-foreground">Total Communications</div>
        </Card>
        <Card className="bg-purple-900/20 border-purple-800/30 p-3">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{commStats.announcements}</div>
          <div className="text-xs text-muted-foreground">Announcements</div>
        </Card>
        <Card className="bg-blue-900/20 border-blue-800/30 p-3">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{commStats.meetings}</div>
          <div className="text-xs text-muted-foreground">Meeting Minutes</div>
        </Card>
        <Card className="bg-amber-900/20 border-amber-800/30 p-3">
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{commStats.decisions}</div>
          <div className="text-xs text-muted-foreground">Decisions</div>
        </Card>
        <Card className="bg-red-900/20 border-red-800/30 p-3">
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{commStats.actions}</div>
          <div className="text-xs text-muted-foreground">Action Items</div>
        </Card>
      </div>

      <Card className="bg-card/60 border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Communications Log</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Announcements, meeting minutes, decisions, and action items</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 bg-muted/50 border-border/50" data-testid="select-filter-comm-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="announcement">Announcements</SelectItem>
                <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                <SelectItem value="status_report">Status Reports</SelectItem>
                <SelectItem value="decision">Decisions</SelectItem>
                <SelectItem value="action_item">Action Items</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-2" data-testid="button-add-communication">
              <Plus className="w-4 h-4" />
              New Communication
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {filteredComms.map((comm) => {
                const TypeIcon: LucideIcon = commTypeIcons[comm.communicationType] || MessageSquare;
                const typeColor = commTypeColors[comm.communicationType] || commTypeColors.general;

                return (
                  <div
                    key={comm.id}
                    className="p-4 bg-muted/40 border border-border/50 rounded-lg hover-elevate"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${typeColor}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize">
                              {comm.communicationType?.replace(/_/g, ' ')}
                            </Badge>
                            {comm.priority && (
                              <Badge className={priorityColors[comm.priority] || ''}>{comm.priority}</Badge>
                            )}
                          </div>
                          <Badge className={statusColors[comm.status] || ''}>{comm.status}</Badge>
                        </div>
                        <h4 className="font-medium mt-2">{comm.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{comm.content}</p>
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground/70">
                          {comm.createdAt && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {new Date(comm.createdAt).toLocaleDateString()}
                            </span>
                          )}
                          {comm.author && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {comm.author}
                            </span>
                          )}
                          {comm.recipients && comm.recipients.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {comm.recipients.length} recipient{comm.recipients.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!filteredComms.length && (
                <div className="text-center text-muted-foreground/70 py-12">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No communications recorded. Start documenting project communications.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    data-testid="button-add-first-communication"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Communication
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
