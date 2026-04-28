import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  CalendarDays,
  ListTodo,
  CheckCircle2,
  Users,
  Circle,
} from "lucide-react";
import type { ProjectData, BusinessCaseData, StakeholderData } from "../../types";

interface KickoffPlannerViewProps {
  project: ProjectData;
  businessCase?: BusinessCaseData;
  stakeholders: StakeholderData[];
}

export function KickoffPlannerView({
  project,
   
  businessCase: _businessCase,
  stakeholders,
}: KickoffPlannerViewProps) {
  const [meetingDate, setMeetingDate] = useState('');
  const { t } = useTranslation();
  const [meetingNotes, setMeetingNotes] = useState('');

  const agendaItems = [
    { id: 1, title: 'Welcome & Introductions', duration: '10 min', presenter: 'Project Manager', completed: false },
    { id: 2, title: 'Project Overview & Objectives', duration: '15 min', presenter: 'Project Manager', completed: false },
    { id: 3, title: 'Scope & Deliverables Review', duration: '15 min', presenter: 'Project Manager', completed: false },
    { id: 4, title: 'Timeline & Key Milestones', duration: '10 min', presenter: 'Project Manager', completed: false },
    { id: 5, title: 'Team Roles & Responsibilities', duration: '15 min', presenter: 'Project Manager', completed: false },
    { id: 6, title: 'Communication Plan', duration: '10 min', presenter: 'Project Manager', completed: false },
    { id: 7, title: 'Risk Overview', duration: '10 min', presenter: 'Project Manager', completed: false },
    { id: 8, title: 'Q&A and Next Steps', duration: '15 min', presenter: 'All', completed: false },
  ];

  const actionItems = [
    { id: 1, action: 'Distribute project charter to all stakeholders', owner: 'Project Manager', dueDate: 'Day 1', status: 'pending' },
    { id: 2, action: 'Schedule individual stakeholder meetings', owner: 'Project Manager', dueDate: 'Week 1', status: 'pending' },
    { id: 3, action: 'Set up project communication channels', owner: 'Project Manager', dueDate: 'Day 1', status: 'pending' },
    { id: 4, action: 'Finalize project team assignments', owner: 'Project Manager', dueDate: 'Week 1', status: 'pending' },
    { id: 5, action: 'Create detailed project schedule', owner: 'Project Manager', dueDate: 'Week 2', status: 'pending' },
    { id: 6, action: 'Conduct risk assessment workshop', owner: 'Project Team', dueDate: 'Week 2', status: 'pending' },
  ];

  const suggestedAttendees = [
    { role: 'Project Sponsor', required: true, invited: stakeholders.some(s => s.stakeholderType === 'sponsor') },
    { role: 'Project Manager', required: true, invited: !!project.projectManagerId },
    { role: 'Technical Lead', required: true, invited: false },
    { role: 'Business Analyst', required: false, invited: false },
    { role: 'Key Stakeholders', required: true, invited: stakeholders.length >= 3 },
    { role: 'Department Representatives', required: false, invited: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Play className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Kick-off Planner</h3>
            <p className="text-xs text-muted-foreground">Meeting planning</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 h-7 text-xs" data-testid="button-schedule-kickoff">
          <CalendarDays className="w-3 h-3" />
          Schedule
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Meeting Agenda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {agendaItems.map((item, i) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted/60 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground">Presenter: {item.presenter}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">{item.duration}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-emerald-900/20 border border-emerald-700/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-emerald-600 dark:text-emerald-400">Total Duration</span>
                  <Badge className="bg-emerald-600">1 hour 40 min</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Post-Kickoff Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actionItems.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50"
                  >
                    <Circle className="w-4 h-4 text-muted-foreground/70" />
                    <div className="flex-1">
                      <div className="text-sm">{item.action}</div>
                      <div className="text-xs text-muted-foreground">Owner: {item.owner}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">{item.dueDate}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Meeting Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Meeting Date & Time</Label>
                <Input 
                  type="datetime-local" 
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="mt-1"
                  data-testid="input-kickoff-date"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Location / Video Link</Label>
                <Input placeholder={t('projectWorkspace.kickoff.locationPlaceholder')} className="mt-1" data-testid="input-kickoff-location" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meeting Notes</Label>
                <Textarea 
                  placeholder={t('projectWorkspace.kickoff.notesPlaceholder')}
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="mt-1 min-h-[100px]"
                  data-testid="textarea-kickoff-notes"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Suggested Attendees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suggestedAttendees.map((attendee, i) => (
                  <div 
                    key={i}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50"
                  >
                    <div className="flex items-center gap-2">
                      {attendee.invited ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/70" />
                      )}
                      <span className="text-sm">{attendee.role}</span>
                    </div>
                    {attendee.required && (
                      <Badge variant="outline" className="text-[10px] text-red-600 dark:text-red-400 border-red-500/30">Required</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
