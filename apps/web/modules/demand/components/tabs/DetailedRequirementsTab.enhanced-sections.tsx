import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Ban,
  Database,
  Gauge,
  GitBranch,
  LayoutList,
  LifeBuoy,
  Link2,
  ListChecks,
  MapPinned,
  Plug,
  ShieldAlert,
  Sigma,
  Target,
  Workflow,
} from 'lucide-react';

/**
 * Enterprise-grade extension sections for the Detailed Requirements tab.
 *
 * These render only when the underlying payload carries the optional enterprise
 * fields (integrations, dataRequirements, operationalRequirements, phasePlan,
 * businessOutcomes, traceabilityMatrix, assumptions, constraints,
 * dependencies, outOfScope). They are intentionally read-only so the core
 * edit/save flow stays unchanged; edits happen upstream via the AI pipeline or
 * a future dedicated editor.
 */

interface IntegrationItem {
  id: string;
  name: string;
  type?: string;
  direction?: string;
  protocol?: string;
  dataExchanged?: string;
  frequency?: string;
  sla?: string;
  security?: string;
  owner?: string;
  dependency?: string;
  phase?: string;
}

interface DataRequirementItem {
  id: string;
  entity: string;
  classification?: string;
  residency?: string;
  source?: string;
  retention?: string;
  qualityRules?: string[];
  owner?: string;
  reportingUse?: string;
  lineage?: string;
}

interface OperationalRequirementItem {
  id: string;
  workflow: string;
  trigger?: string;
  escalationPath?: string;
  failSafeMode?: string;
  manualOverride?: string;
  rto?: string;
  rpo?: string;
  owner?: string;
  safetyCritical?: boolean;
  phase?: string;
}

interface PhasePlanItem {
  phase: string;
  name?: string;
  timing?: string;
  objectives?: string[];
  mustHave?: string[];
  shouldHave?: string[];
  couldHave?: string[];
  wontHave?: string[];
  exitCriteria?: string[];
}

interface BusinessOutcomeItem {
  id: string;
  outcome: string;
  driver?: string;
  metric?: string;
  baseline?: string;
  target?: string;
  linkedCapabilities?: string[];
  linkedRequirementIds?: string[];
}

interface TraceabilityRow {
  capability: string;
  requirementId: string;
  acceptanceCriteriaRef?: string;
  phase?: string;
  owner?: string;
  testMethod?: string;
  businessOutcome?: string;
}

interface EnhancedSectionsProps {
  integrations?: IntegrationItem[];
  dataRequirements?: DataRequirementItem[];
  operationalRequirements?: OperationalRequirementItem[];
  phasePlan?: PhasePlanItem[];
  businessOutcomes?: BusinessOutcomeItem[];
  traceabilityMatrix?: TraceabilityRow[];
  assumptions?: string[];
  constraints?: string[];
  dependencies?: string[];
  outOfScope?: string[];
  highlightedSection?: string | null;
  requirementLabelMap?: Record<string, string>;
  sectionGovernance?: Partial<Record<string, { statusControls?: ReactNode; assignmentPanel?: ReactNode }>>;
}

function hasAny(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function SectionCard({
  id,
  icon,
  title,
  description,
  headerBadge,
  statusControls,
  assignmentPanel,
  highlighted,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description?: string;
  headerBadge?: ReactNode;
  statusControls?: ReactNode;
  assignmentPanel?: ReactNode;
  highlighted?: boolean;
  children: ReactNode;
}) {
  return (
    <Card
      id={`section-${id}`}
      data-testid={`section-${id}`}
      className={highlighted ? 'ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl' : ''}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                {icon}
              </div>
              {title}
            </CardTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {(headerBadge || statusControls) && (
            <div className="flex items-center gap-2 flex-wrap">
              {headerBadge}
              {statusControls}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignmentPanel}
        {children}
      </CardContent>
    </Card>
  );
}

function KeyValue({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function PhaseBadge({ phase }: { phase?: string }) {
  if (!phase) return null;
  const normalized = String(phase).toLowerCase();
  let tone = 'bg-muted text-foreground border-border';
  if (normalized.includes('mvp') || normalized.includes('phase 1')) {
    tone = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  } else if (normalized.includes('phase 2')) {
    tone = 'bg-blue-500/10 text-blue-700 border-blue-500/20';
  } else if (normalized.includes('phase 3')) {
    tone = 'bg-purple-500/10 text-purple-700 border-purple-500/20';
  }
  return <Badge variant="outline" className={`text-xs ${tone}`}>{phase}</Badge>;
}

function BulletList({ items, tone = 'default' }: { items?: string[]; tone?: 'default' | 'warn' | 'danger' | 'success' }) {
  if (!hasAny(items)) return null;
  const marker = {
    default: 'bg-primary/70',
    warn: 'bg-amber-500',
    danger: 'bg-rose-500',
    success: 'bg-emerald-500',
  }[tone];
  return (
    <ul className="space-y-1.5">
      {items!.map((item, idx) => (
        <li key={idx} className="text-sm flex items-start gap-2">
          <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${marker}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function DetailedRequirementsEnhancedSections({
  integrations,
  dataRequirements,
  operationalRequirements,
  phasePlan,
  businessOutcomes,
  traceabilityMatrix,
  assumptions,
  constraints,
  dependencies,
  outOfScope,
  highlightedSection,
  requirementLabelMap,
  sectionGovernance,
}: EnhancedSectionsProps) {
  const { t } = useTranslation();
  const copy = (key: string, fallback: string) => {
    const value = t(key);
    return !value || value === key ? fallback : value;
  };
  const getReferenceLabel = (reference: string) => requirementLabelMap?.[reference] || reference;
  const mapReferenceList = (items?: string[]) => items?.map((item) => getReferenceLabel(item));

  const hasAnyContent = useMemo(
    () =>
      hasAny(integrations) ||
      hasAny(dataRequirements) ||
      hasAny(operationalRequirements) ||
      hasAny(phasePlan) ||
      hasAny(businessOutcomes) ||
      hasAny(traceabilityMatrix) ||
      hasAny(assumptions) ||
      hasAny(constraints) ||
      hasAny(dependencies) ||
      hasAny(outOfScope),
    [
      integrations,
      dataRequirements,
      operationalRequirements,
      phasePlan,
      businessOutcomes,
      traceabilityMatrix,
      assumptions,
      constraints,
      dependencies,
      outOfScope,
    ],
  );

  if (!hasAnyContent) return null;

  return (
    <>
      {hasAny(phasePlan) && (
        <SectionCard
          id="phasePlan"
          icon={<LayoutList className="h-4 w-4" />}
          title={copy('demand.tabs.requirements.phasedDelivery', 'Delivery Roadmap & Release Scope')}
          description={copy('demand.tabs.requirements.phasedDeliveryDesc', 'Scope committed per phase with explicit Must / Should / Could / Won’t prioritization and exit criteria.')}
          headerBadge={<Badge variant="secondary" className="text-xs font-semibold"><Sigma className="h-3 w-3 mr-1" />{phasePlan!.length} phases</Badge>}
          statusControls={sectionGovernance?.phasePlan?.statusControls}
          assignmentPanel={sectionGovernance?.phasePlan?.assignmentPanel}
          highlighted={highlightedSection === 'phasePlan'}
        >
          <div className="space-y-4">
            {phasePlan!.map((phase, idx) => (
              <div key={`${phase.phase}-${idx}`} className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <PhaseBadge phase={phase.phase} />
                  {phase.name && <h4 className="font-semibold text-sm">{phase.name}</h4>}
                  {phase.timing && <span className="text-xs text-muted-foreground">· {phase.timing}</span>}
                </div>
                {hasAny(phase.objectives) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Objectives</p>
                    <BulletList items={phase.objectives} />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Must have</p>
                    <BulletList items={mapReferenceList(phase.mustHave)} tone="success" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">Should have</p>
                    <BulletList items={mapReferenceList(phase.shouldHave)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">Could have</p>
                    <BulletList items={mapReferenceList(phase.couldHave)} tone="warn" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-rose-700 mb-1">Won’t have (this phase)</p>
                    <BulletList items={mapReferenceList(phase.wontHave)} tone="danger" />
                  </div>
                </div>
                {hasAny(phase.exitCriteria) && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Exit criteria</p>
                    <BulletList items={phase.exitCriteria} tone="success" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {hasAny(integrations) && (
        <SectionCard
          id="integrations"
          icon={<Plug className="h-4 w-4" />}
          title={copy('demand.tabs.requirements.integrations', 'Integration Landscape')}
          description={copy('demand.tabs.requirements.integrationsDesc', 'Interfaces with RTA platforms, payment services, customer channels, enterprise systems, and control ecosystems.')}
          headerBadge={<Badge variant="secondary" className="text-xs font-semibold"><Plug className="h-3 w-3 mr-1" />{integrations!.length} interfaces</Badge>}
          statusControls={sectionGovernance?.integrations?.statusControls}
          assignmentPanel={sectionGovernance?.integrations?.assignmentPanel}
          highlighted={highlightedSection === 'integrations'}
        >
          <div className="space-y-3">
            {integrations!.map((itg) => (
              <div key={itg.id} className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{itg.id}</code>
                  <h4 className="font-semibold">{itg.name}</h4>
                  {itg.type && <Badge variant="outline" className="text-xs">{itg.type}</Badge>}
                  {itg.direction && <Badge variant="outline" className="text-xs capitalize">{itg.direction}</Badge>}
                  <PhaseBadge phase={itg.phase} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KeyValue label="Protocol" value={itg.protocol} />
                  <KeyValue label="Frequency" value={itg.frequency} />
                  <KeyValue label="SLA" value={itg.sla} />
                  <KeyValue label="Security" value={itg.security} />
                  <KeyValue label="Data exchanged" value={itg.dataExchanged} />
                  <KeyValue label="Owner" value={itg.owner} />
                  <KeyValue label="Dependency" value={itg.dependency} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {hasAny(dataRequirements) && (
        <SectionCard
          id="dataRequirements"
          icon={<Database className="h-4 w-4" />}
          title={copy('demand.tabs.requirements.dataRequirements', 'Data Governance & Reporting')}
          description={copy('demand.tabs.requirements.dataRequirementsDesc', 'Data entities, classification, residency, retention, quality controls, and downstream reporting obligations.')}
          headerBadge={<Badge variant="secondary" className="text-xs font-semibold"><Database className="h-3 w-3 mr-1" />{dataRequirements!.length} entities</Badge>}
          statusControls={sectionGovernance?.dataRequirements?.statusControls}
          assignmentPanel={sectionGovernance?.dataRequirements?.assignmentPanel}
          highlighted={highlightedSection === 'dataRequirements'}
        >
          <div className="space-y-3">
            {dataRequirements!.map((d) => (
              <div key={d.id} className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{d.id}</code>
                  <h4 className="font-semibold">{d.entity}</h4>
                  {d.classification && <Badge variant="outline" className="text-xs">{d.classification}</Badge>}
                  {d.residency && <Badge variant="outline" className="text-xs"><MapPinned className="h-3 w-3 mr-1" />{d.residency}</Badge>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KeyValue label="Source" value={d.source} />
                  <KeyValue label="Retention" value={d.retention} />
                  <KeyValue label="Owner" value={d.owner} />
                  <KeyValue label="Reporting use" value={d.reportingUse} />
                  <KeyValue label="Lineage" value={d.lineage} />
                </div>
                {hasAny(d.qualityRules) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Data quality rules</p>
                    <BulletList items={d.qualityRules} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {hasAny(operationalRequirements) && (
        <SectionCard
          id="operationalRequirements"
          icon={<Workflow className="h-4 w-4" />}
          title={copy('demand.tabs.requirements.operationalRequirements', 'Operational Workflows & Continuity')}
          description={copy('demand.tabs.requirements.operationalRequirementsDesc', 'Operational runbooks, fail-safe modes, manual override governance, escalation paths, and continuity targets.')}
          headerBadge={<Badge variant="secondary" className="text-xs font-semibold"><LifeBuoy className="h-3 w-3 mr-1" />{operationalRequirements!.length} workflows</Badge>}
          statusControls={sectionGovernance?.operationalRequirements?.statusControls}
          assignmentPanel={sectionGovernance?.operationalRequirements?.assignmentPanel}
          highlighted={highlightedSection === 'operationalRequirements'}
        >
          <div className="space-y-3">
            {operationalRequirements!.map((op) => (
              <div key={op.id} className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{op.id}</code>
                  <h4 className="font-semibold">{op.workflow}</h4>
                  {op.safetyCritical && (
                    <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-700 border-rose-500/20">
                      <ShieldAlert className="h-3 w-3 mr-1" />Safety-critical
                    </Badge>
                  )}
                  <PhaseBadge phase={op.phase} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KeyValue label="Trigger" value={op.trigger} />
                  <KeyValue label="Escalation path" value={op.escalationPath} />
                  <KeyValue label="Fail-safe mode" value={op.failSafeMode} />
                  <KeyValue label="Manual override governance" value={op.manualOverride} />
                  <KeyValue label="RTO" value={op.rto} />
                  <KeyValue label="RPO" value={op.rpo} />
                  <KeyValue label="Owner" value={op.owner} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {hasAny(businessOutcomes) && (
        <SectionCard
          id="businessOutcomes"
          icon={<Target className="h-4 w-4" />}
          title={copy('demand.tabs.requirements.businessOutcomes', 'Business Outcome Traceability')}
          description={copy('demand.tabs.requirements.businessOutcomesDesc', 'Each measurable outcome is linked back to capabilities and named requirements, not just internal IDs.')}
          headerBadge={<Badge variant="secondary" className="text-xs font-semibold"><Target className="h-3 w-3 mr-1" />{businessOutcomes!.length} outcomes</Badge>}
          statusControls={sectionGovernance?.businessOutcomes?.statusControls}
          assignmentPanel={sectionGovernance?.businessOutcomes?.assignmentPanel}
          highlighted={highlightedSection === 'businessOutcomes'}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {businessOutcomes!.map((bo) => (
              <div key={bo.id} className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{bo.id}</code>
                  <h4 className="font-semibold">{bo.outcome}</h4>
                </div>
                {bo.driver && <p className="text-sm text-muted-foreground">{bo.driver}</p>}
                <div className="grid grid-cols-3 gap-2">
                  <KeyValue label="Baseline" value={bo.baseline} />
                  <KeyValue label="Target" value={bo.target} />
                  <KeyValue label="Metric" value={bo.metric} />
                </div>
                {hasAny(bo.linkedCapabilities) && (
                  <div className="flex flex-wrap gap-1">
                    {bo.linkedCapabilities!.map((c) => (
                      <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                    ))}
                  </div>
                )}
                {hasAny(bo.linkedRequirementIds) && (
                  <div className="flex flex-wrap gap-1">
                    {bo.linkedRequirementIds!.map((rid) => (
                      <Badge key={rid} variant="outline" className="text-[10px] font-normal">{getReferenceLabel(rid)}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {hasAny(traceabilityMatrix) && (
        <SectionCard
          id="traceabilityMatrix"
          icon={<Link2 className="h-4 w-4" />}
          title={copy('demand.tabs.requirements.traceabilityMatrix', 'Requirement Lineage Matrix')}
          description={copy('demand.tabs.requirements.traceabilityMatrixDesc', 'Capability → named requirement → acceptance criteria → owner → phase → test method → business outcome.')}
          headerBadge={<Badge variant="secondary" className="text-xs font-semibold"><GitBranch className="h-3 w-3 mr-1" />{traceabilityMatrix!.length} links</Badge>}
          statusControls={sectionGovernance?.traceabilityMatrix?.statusControls}
          assignmentPanel={sectionGovernance?.traceabilityMatrix?.assignmentPanel}
          highlighted={highlightedSection === 'traceabilityMatrix'}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Capability</th>
                  <th className="py-2 pr-3 font-medium">Requirement</th>
                  <th className="py-2 pr-3 font-medium">AC Ref</th>
                  <th className="py-2 pr-3 font-medium">Phase</th>
                  <th className="py-2 pr-3 font-medium">Owner</th>
                  <th className="py-2 pr-3 font-medium">Test method</th>
                  <th className="py-2 pr-3 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {traceabilityMatrix!.map((row, idx) => (
                  <tr key={`${row.requirementId}-${idx}`} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">{row.capability}</td>
                    <td className="py-2 pr-3">
                      <div className="space-y-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.requirementId}</code>
                        <p className="text-xs text-muted-foreground">{getReferenceLabel(row.requirementId)}</p>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.acceptanceCriteriaRef || '—'}</td>
                    <td className="py-2 pr-3"><PhaseBadge phase={row.phase} /></td>
                    <td className="py-2 pr-3">{row.owner || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.testMethod || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{row.businessOutcome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {(hasAny(assumptions) || hasAny(constraints) || hasAny(dependencies) || hasAny(outOfScope)) && (
        <SectionCard
          id="assumptionsConstraints"
          icon={<ListChecks className="h-4 w-4" />}
          title={copy('demand.tabs.requirements.assumptionsConstraints', 'Planning Assumptions & Delivery Boundaries')}
          description={copy('demand.tabs.requirements.assumptionsConstraintsDesc', 'Baseline assumptions, hard constraints, dependencies, and explicit exclusions that define the delivery boundary.')}
          statusControls={sectionGovernance?.assumptionsConstraints?.statusControls}
          assignmentPanel={sectionGovernance?.assumptionsConstraints?.assignmentPanel}
          highlighted={highlightedSection === 'assumptionsConstraints'}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {hasAny(assumptions) && (
              <div className="rounded-md border border-border/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold text-sm">Assumptions</h4>
                </div>
                <BulletList items={assumptions} />
              </div>
            )}
            {hasAny(constraints) && (
              <div className="rounded-md border border-border/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h4 className="font-semibold text-sm">Constraints</h4>
                </div>
                <BulletList items={constraints} tone="warn" />
              </div>
            )}
            {hasAny(dependencies) && (
              <div className="rounded-md border border-border/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  <h4 className="font-semibold text-sm">Dependencies</h4>
                </div>
                <BulletList items={dependencies} />
              </div>
            )}
            {hasAny(outOfScope) && (
              <div className="rounded-md border border-border/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ban className="h-4 w-4 text-rose-600" />
                  <h4 className="font-semibold text-sm">Out of scope</h4>
                </div>
                <BulletList items={outOfScope} tone="danger" />
              </div>
            )}
          </div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            These items form the contractual boundary of the requirements baseline — anything not listed here is implicitly in-scope.
          </p>
        </SectionCard>
      )}
    </>
  );
}
