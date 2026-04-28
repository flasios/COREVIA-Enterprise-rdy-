import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Clock, Edit, FileText, Loader2, MapPin, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';

interface StakeholderItem {
  email: string;
  role: string;
}

interface AgendaItem {
  title: string;
  duration: number;
}

interface BusinessCaseMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingDate: string;
  onMeetingDateChange: (value: string) => void;
  meetingTime: string;
  onMeetingTimeChange: (value: string) => void;
  meetingDuration: string;
  onMeetingDurationChange: (value: string) => void;
  meetingLocation: string;
  onMeetingLocationChange: (value: string) => void;
  meetingNotes: string;
  onMeetingNotesChange: (value: string) => void;
  projectTitle: string;
  stakeholders: StakeholderItem[];
  newStakeholderEmail: string;
  onNewStakeholderEmailChange: (value: string) => void;
  newStakeholderRole: string;
  onNewStakeholderRoleChange: (value: string) => void;
  onAddStakeholder: () => void;
  onRemoveStakeholder: (index: number) => void;
  agendaItems: AgendaItem[];
  newAgendaTitle: string;
  onNewAgendaTitleChange: (value: string) => void;
  newAgendaDuration: string;
  onNewAgendaDurationChange: (value: string) => void;
  onAddAgendaItem: () => void;
  onRemoveAgendaItem: (index: number) => void;
  onScheduleMeeting: () => void;
  isSchedulingMeeting: boolean;
}

export function BusinessCaseMeetingDialog({
  open,
  onOpenChange,
  meetingDate,
  onMeetingDateChange,
  meetingTime,
  onMeetingTimeChange,
  meetingDuration,
  onMeetingDurationChange,
  meetingLocation,
  onMeetingLocationChange,
  meetingNotes,
  onMeetingNotesChange,
  projectTitle,
  stakeholders,
  newStakeholderEmail,
  onNewStakeholderEmailChange,
  newStakeholderRole,
  onNewStakeholderRoleChange,
  onAddStakeholder,
  onRemoveStakeholder,
  agendaItems,
  newAgendaTitle,
  onNewAgendaTitleChange,
  newAgendaDuration,
  onNewAgendaDurationChange,
  onAddAgendaItem,
  onRemoveAgendaItem,
  onScheduleMeeting,
  isSchedulingMeeting,
}: BusinessCaseMeetingDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="space-y-3 border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 shadow-xl">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <DialogTitle className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-2xl font-bold text-transparent">
                {t('demand.tabs.businessCase.scheduleBusinessCaseReview')}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {t('demand.tabs.businessCase.meetingCoordinationDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4 w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/50 p-1 sm:grid-cols-4">
            <TabsTrigger value="details" className="px-2 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
              <Clock className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('demand.tabs.businessCase.details')}</span>
            </TabsTrigger>
            <TabsTrigger value="stakeholders" className="px-2 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
              <Users className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('demand.tabs.businessCase.stakeholders')}</span>
              {stakeholders.length > 0 && (
                <Badge className="ml-1 h-4 bg-blue-600 px-1 text-[9px] text-white">{stakeholders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="agenda" className="px-2 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
              <FileText className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('demand.tabs.businessCase.agenda')}</span>
              {agendaItems.length > 0 && (
                <Badge className="ml-1 h-4 bg-purple-600 px-1 text-[9px] text-white">{agendaItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="px-2 py-1.5 text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white">
              <Edit className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('demand.tabs.businessCase.notes')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <Card className="border-2 border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                  {t('demand.tabs.businessCase.meetingScheduleLogistics')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="meeting-date" className="flex items-center gap-1 font-semibold">
                      {t('demand.tabs.businessCase.date')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="meeting-date"
                      type="date"
                      value={meetingDate}
                      onChange={(event) => onMeetingDateChange(event.target.value)}
                      className="mt-1.5"
                      min={new Date().toISOString().split('T')[0]}
                      data-testid="input-meeting-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="meeting-time" className="flex items-center gap-1 font-semibold">
                      {t('demand.tabs.businessCase.time')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="meeting-time"
                      type="time"
                      value={meetingTime}
                      onChange={(event) => onMeetingTimeChange(event.target.value)}
                      className="mt-1.5"
                      data-testid="input-meeting-time"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="meeting-duration" className="font-semibold">
                      {t('demand.tabs.businessCase.durationMinutes')}
                    </Label>
                    <Select value={meetingDuration} onValueChange={onMeetingDurationChange}>
                      <SelectTrigger className="mt-1.5" data-testid="select-meeting-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">{t('demand.tabs.businessCase.thirtyMinutes')}</SelectItem>
                        <SelectItem value="45">{t('demand.tabs.businessCase.fortyFiveMinutes')}</SelectItem>
                        <SelectItem value="60">{t('demand.tabs.businessCase.oneHour')}</SelectItem>
                        <SelectItem value="90">{t('demand.tabs.businessCase.oneAndHalfHours')}</SelectItem>
                        <SelectItem value="120">{t('demand.tabs.businessCase.twoHours')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="meeting-location" className="flex items-center gap-1 font-semibold">
                      <MapPin className="h-3.5 w-3.5" />
                      {t('demand.tabs.businessCase.locationMeetingLink')}
                    </Label>
                    <Input
                      id="meeting-location"
                      value={meetingLocation}
                      onChange={(event) => onMeetingLocationChange(event.target.value)}
                      placeholder="Conference Room 3A or https://meet.example.com/..."
                      className="mt-1.5"
                      data-testid="input-meeting-location"
                    />
                  </div>
                </div>

                <div>
                  <Label className="font-semibold">{t('demand.tabs.businessCase.meetingPurpose', 'Meeting Purpose')}</Label>
                  <div className="mt-1.5 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                    {t('demand.tabs.businessCase.meetingPurposeDefault', 'Review and discuss the Business Case for')} <span className="font-medium text-foreground">{projectTitle || 'this demand'}</span>. {t('demand.tabs.businessCase.meetingPurposeDetails', 'Evaluate financial model, risk assessment, and implementation plan. Seek stakeholder alignment and approval.')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stakeholders" className="mt-4 space-y-4">
            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  Add Stakeholders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="stakeholder-email">{t('demand.tabs.businessCase.emailAddress')}</Label>
                    <Input
                      id="stakeholder-email"
                      type="email"
                      value={newStakeholderEmail}
                      onChange={(event) => onNewStakeholderEmailChange(event.target.value)}
                      placeholder="stakeholder@organization.gov.ae"
                      className="mt-1.5"
                      data-testid="input-stakeholder-email"
                    />
                  </div>
                  <div className="w-48">
                    <Label htmlFor="stakeholder-role">{t('demand.tabs.businessCase.role')}</Label>
                    <Select value={newStakeholderRole} onValueChange={onNewStakeholderRoleChange}>
                      <SelectTrigger className="mt-1.5" data-testid="select-stakeholder-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Business Stakeholder">{t('demand.tabs.businessCase.businessStakeholder')}</SelectItem>
                        <SelectItem value="Technical Lead">{t('demand.tabs.businessCase.technicalLead')}</SelectItem>
                        <SelectItem value="Finance Director">{t('demand.tabs.businessCase.financeDirector')}</SelectItem>
                        <SelectItem value="Department Head">{t('demand.tabs.businessCase.departmentHead')}</SelectItem>
                        <SelectItem value="Project Manager">{t('demand.tabs.businessCase.projectManager')}</SelectItem>
                        <SelectItem value="Executive Sponsor">{t('demand.tabs.businessCase.executiveSponsor')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={onAddStakeholder} className="bg-gradient-to-r from-blue-500 to-cyan-600" data-testid="button-add-stakeholder">
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>

                {stakeholders.length > 0 ? (
                  <div className="space-y-2 border-t pt-4">
                    <Label className="text-sm font-semibold">{t('demand.tabs.businessCase.invitedStakeholders', { count: stakeholders.length })}</Label>
                    <div className="max-h-60 space-y-2 overflow-y-auto">
                      {stakeholders.map((stakeholder, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border-2 border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/20"
                          data-testid={`stakeholder-${index}`}
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium">{stakeholder.email}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{stakeholder.role}</div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveStakeholder(index)}
                            className="text-red-600 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950"
                            data-testid={`button-remove-stakeholder-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p className="text-sm">{t('demand.tabs.businessCase.noStakeholdersYet')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agenda" className="mt-4 space-y-4">
            <Card className="border-2 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-purple-600" />
                  {t('demand.tabs.businessCase.buildMeetingAgenda')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label htmlFor="agenda-title">{t('demand.tabs.businessCase.agendaItem')}</Label>
                    <Input
                      id="agenda-title"
                      value={newAgendaTitle}
                      onChange={(event) => onNewAgendaTitleChange(event.target.value)}
                      placeholder="e.g., Review ROI Analysis"
                      className="mt-1.5"
                      data-testid="input-agenda-title"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor="agenda-duration">{t('demand.tabs.businessCase.minutes')}</Label>
                    <Input
                      id="agenda-duration"
                      type="number"
                      value={newAgendaDuration}
                      onChange={(event) => onNewAgendaDurationChange(event.target.value)}
                      min="5"
                      max="120"
                      className="mt-1.5"
                      data-testid="input-agenda-duration"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={onAddAgendaItem} className="bg-gradient-to-r from-purple-500 to-pink-600" data-testid="button-add-agenda">
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">{t('demand.tabs.businessCase.agendaItemsLabel', { count: agendaItems.length })}</Label>
                    <div className="text-sm text-muted-foreground">
                      {t('demand.tabs.businessCase.total')}: {agendaItems.reduce((sum, item) => sum + item.duration, 0)} {t('demand.tabs.businessCase.minutes')}
                    </div>
                  </div>
                  <div className="max-h-60 space-y-2 overflow-y-auto">
                    {agendaItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border-2 border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-950/20"
                        data-testid={`agenda-item-${index}`}
                      >
                        <div className="flex flex-1 items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-600 text-sm font-semibold text-white">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{item.title}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{item.duration} minutes</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveAgendaItem(index)}
                          className="text-red-600 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-950"
                          data-testid={`button-remove-agenda-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            <Card className="border-2 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Edit className="h-5 w-5 text-green-600" />
                  {t('demand.tabs.businessCase.additionalNotesContext')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="meeting-notes" className="font-semibold">
                  {t('demand.tabs.businessCase.meetingContextLabel')}
                </Label>
                <Textarea
                  id="meeting-notes"
                  value={meetingNotes}
                  onChange={(event) => onMeetingNotesChange(event.target.value)}
                  placeholder="Add any additional context for this meeting, such as:&#10;• Key decision points to address&#10;• Pre-meeting preparation requirements&#10;• Expected outcomes&#10;• Follow-up actions..."
                  className="mt-2 min-h-[150px]"
                  data-testid="textarea-meeting-notes"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('demand.tabs.businessCase.notesIncludedInInvitation')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 gap-3 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2" data-testid="button-cancel-meeting">
            <X className="mr-2 h-4 w-4" />
            {t('demand.tabs.businessCase.cancel')}
          </Button>
          <Button
            onClick={onScheduleMeeting}
            disabled={!meetingDate || !meetingTime || isSchedulingMeeting}
            className="border-0 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 shadow-xl hover:from-amber-600 hover:via-orange-600 hover:to-red-600"
            data-testid="button-confirm-meeting"
          >
            {isSchedulingMeeting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('demand.tabs.businessCase.schedulingMeeting')}
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                {t('demand.tabs.businessCase.scheduleMeeting')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}