import { Switch, Route } from "wouter";
import { useTranslation } from 'react-i18next';
import { BrainLayout } from "./BrainLayout";
import { Dashboard } from "./Dashboard";
import { DecisionsList } from "./DecisionsList";
import { DecisionDetail } from "./DecisionDetail";
import { NewIntake } from "./NewIntake";
import { Services } from "./Services";
import { Agents } from "./Agents";
import { Policies } from "./Policies";
import { Learning } from "./Learning";
import { Intelligence } from "./Intelligence";
import { AuditTrail } from "./AuditTrail";
import { AIAssistantHub } from "./AIAssistantHub";
import { AssistantControl } from "./AssistantControl";

const BRAIN_BASE = "/brain-console";

export default function BrainConsole() {
  const { t: _t } = useTranslation();
  return (
    <BrainLayout>
      <Switch>
        <Route path={BRAIN_BASE} component={Dashboard} />
        <Route path={`${BRAIN_BASE}/decisions`} component={DecisionsList} />
        <Route path={`${BRAIN_BASE}/decisions/:id`} component={DecisionDetail} />
        <Route path={`${BRAIN_BASE}/intelligence`} component={Intelligence} />
        <Route path={`${BRAIN_BASE}/new`} component={NewIntake} />
        <Route path={`${BRAIN_BASE}/services`} component={Services} />
        <Route path={`${BRAIN_BASE}/services/:id`} component={Services} />
        <Route path={`${BRAIN_BASE}/agents`} component={Agents} />
        <Route path={`${BRAIN_BASE}/policies`} component={Policies} />
        <Route path={`${BRAIN_BASE}/audit-trail`} component={AuditTrail} />
        <Route path={`${BRAIN_BASE}/learning`} component={Learning} />
        <Route path={`${BRAIN_BASE}/ai-assistant`} component={AIAssistantHub} />
        <Route path={`${BRAIN_BASE}/advisor`} component={AssistantControl} />
        <Route component={Dashboard} />
      </Switch>
    </BrainLayout>
  );
}
