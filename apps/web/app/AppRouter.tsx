import { Switch, Route, Redirect, useLocation } from "wouter";
import { lazy } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

const Home = lazy(() => import("@/pages/Home"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const NotFound = lazy(() => import("@/pages/not-found"));

const IntelligentGateway = lazy(() => import("@/pages/IntelligentGateway"));
const IntelligentWorkspace = lazy(() => import("@/pages/IntelligentWorkspace"));
const DemandProductHome = lazy(() => import("@/pages/DemandProductHome"));
const IntelligentLibrary = lazy(() => import("@/pages/IntelligentLibrary"));
const KnowledgeCentre = lazy(() => import("@/pages/KnowledgeCentre"));
const KnowledgeHubLanding = lazy(() => import("@/pages/KnowledgeHubLanding"));
const EARegistryLanding = lazy(() => import("@/pages/EARegistryLanding"));
const CapabilityRegistry = lazy(() => import("@/pages/CapabilityRegistry"));
const ApplicationRegistry = lazy(() => import("@/pages/ApplicationRegistry"));
const DataDomainRegistry = lazy(() => import("@/pages/DataDomainRegistry"));
const TechnologyStandards = lazy(() => import("@/pages/TechnologyStandards"));
const IntegrationRegistry = lazy(() => import("@/pages/IntegrationRegistry"));
const DemandAnalysis = lazy(() => import("@/pages/DemandAnalysis"));
const DemandAnalysisReport = lazy(() => import("@/pages/DemandAnalysisReport"));
const ProjectApproval = lazy(() => import("@/pages/ProjectApproval"));
const RiskManagement = lazy(() => import("@/pages/RiskManagement"));
const ComplianceTracking = lazy(() => import("@/pages/ComplianceTracking"));
const ResourceAllocation = lazy(() => import("@/pages/ResourceAllocation"));
const PerformanceReporting = lazy(() => import("@/pages/PerformanceReporting"));
const DemandSubmitted = lazy(() => import("@/pages/DemandSubmitted"));
const DemandSubmittedList = lazy(() => import("@/pages/DemandSubmittedList"));
const SystemMonitoring = lazy(() => import("@/pages/SystemMonitoring"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const TeamManagement = lazy(() => import("@/pages/TeamManagement"));
const SynergyDashboard = lazy(() => import("@/pages/SynergyDashboard"));
const IntelligentPortfolioGateway = lazy(() => import("@/pages/IntelligentPortfolioGateway"));
const ProjectWorkspace = lazy(() => import("@/pages/ProjectWorkspace"));
const TenderGateway = lazy(() => import("@/pages/TenderGateway"));
const PortfolioHub = lazy(() => import("@/pages/PortfolioHub"));
const PMOOffice = lazy(() => import("@/pages/PMOOffice"));
const DemandIntakePipeline = lazy(() => import("@/pages/DemandIntakePipeline"));
const QualityAssurance = lazy(() => import("@/pages/QualityAssurance"));
const ProjectManagerHub = lazy(() => import("@/pages/ProjectManagerHub"));
const AIAssistant = lazy(() => import("@/pages/AIAssistant"));
const DlpDashboard = lazy(() => import("@/pages/DlpDashboard"));
const BrainConsole = lazy(() => import("@/pages/brain/BrainConsole"));
const IntegrationHub = lazy(() => import("@/pages/integration/IntegrationHubPage"));

function BrainConsoleRoute() {
  return (
    <ProtectedRoute requiredPermissions={["brain:view"]}>
      <BrainConsole />
    </ProtectedRoute>
  );
}

function BrainRunRoute() {
  return (
    <ProtectedRoute requiredPermissions={["brain:run"]}>
      <BrainConsole />
    </ProtectedRoute>
  );
}

function DecisionRedirect({ id }: Readonly<{ id: string }>) {
  const [location] = useLocation();
  const search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  return <Redirect to={`/brain-console/decisions/${id}${search}`} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/decisions">
        {() => <Redirect to="/brain-console/decisions" />}
      </Route>
      <Route path="/portfolio">
        {() => <Redirect to="/portfolio-hub" />}
      </Route>
      <Route path="/decision-brain">
        {() => <Redirect to="/brain-console/decisions" />}
      </Route>
      <Route path="/decisions/:id">
        {(params) => <DecisionRedirect id={params.id} />}
      </Route>
      <Route path="/brain-console" component={BrainConsoleRoute} />
      <Route path="/brain-console/decisions" component={BrainConsoleRoute} />
      <Route path="/brain-console/decisions/:id" component={BrainConsoleRoute} />
      <Route path="/brain-console/intelligence" component={BrainConsoleRoute} />
      <Route path="/brain-console/new" component={BrainRunRoute} />
      <Route path="/brain-console/services" component={BrainConsoleRoute} />
      <Route path="/brain-console/services/:id" component={BrainConsoleRoute} />
      <Route path="/brain-console/agents" component={BrainConsoleRoute} />
      <Route path="/brain-console/policies" component={BrainConsoleRoute} />
      <Route path="/brain-console/audit-trail" component={BrainConsoleRoute} />
      <Route path="/brain-console/learning" component={BrainConsoleRoute} />
      <Route path="/brain-console/ai-assistant" component={BrainConsoleRoute} />
      <Route path="/brain-console/advisor" component={BrainConsoleRoute} />
      <Route path="/integration-hub">
        {() => (
          <ProtectedRoute requiredPermissions={["integration:hub:view"]} redirectOnDeny="/">
            <IntegrationHub />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/decision-workspace/:id">
        {(params) => <DecisionRedirect id={params.id} />}
      </Route>
      <Route path="/">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <Home />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/intelligent-gateway">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <IntelligentGateway />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/intelligent-workspace">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <IntelligentWorkspace />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-intake">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandIntakePipeline />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-home">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandProductHome />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/intelligent-library">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <IntelligentLibrary />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/knowledge-centre">
        {() => (
          <ProtectedRoute requiredPermissions={["knowledge:read"]} redirectOnDeny="/intelligent-library?section=demands">
            <KnowledgeCentre />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/knowledge-hub">
        {() => (
          <ProtectedRoute requiredPermissions={["knowledge:read"]} redirectOnDeny="/intelligent-library?section=demands">
            <KnowledgeHubLanding />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ea-registry">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <EARegistryLanding />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ea-registry/capabilities">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <CapabilityRegistry />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ea-registry/applications">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <ApplicationRegistry />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ea-registry/data-domains">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DataDomainRegistry />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ea-registry/technology">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <TechnologyStandards />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ea-registry/integrations">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <IntegrationRegistry />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-analysis">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandAnalysis />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/project-approval">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <ProjectApproval />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/risk-management">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <RiskManagement />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/compliance-tracking">
        {() => (
          <ProtectedRoute requiredPermissions={["compliance:view"]}>
            <ComplianceTracking />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/quality-assurance">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <QualityAssurance />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/resource-allocation">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <ResourceAllocation />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/performance-reporting">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <PerformanceReporting />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-analysis/:id">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandAnalysisReport />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-analysis-reports/:id">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandAnalysisReport />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-submitted">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandSubmittedList />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-submitted/:id">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandSubmitted />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/demand-reports/:id">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <DemandAnalysisReport />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/system-monitoring">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <SystemMonitoring />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/users">
        {() => (
          <ProtectedRoute requiredPermissions={["user:read"]}>
            <UserManagement />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/teams">
        {() => (
          <ProtectedRoute requiredPermissions={["team:view-members"]}>
            <TeamManagement />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/admin/dlp">
        {() => (
          <ProtectedRoute requiredPermissions={["dlp:view"]}>
            <DlpDashboard />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/synergies">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <SynergyDashboard />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/intelligent-portfolio">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <IntelligentPortfolioGateway />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/project/:id">
        {() => (
          <ProtectedRoute requiredPermissions={["project:view"]}>
            <ProjectWorkspace />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/portfolio-gateway">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <IntelligentPortfolioGateway />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/tenders">
        {() => (
          <ProtectedRoute requiredPermissions={["tender:generate"]}>
            <TenderGateway />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/tenders/:id">
        {() => (
          <ProtectedRoute requiredPermissions={["tender:generate"]}>
            <TenderGateway />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/portfolio-hub">
        {() => (
          <ProtectedRoute requiredPermissions={["portfolio:view"]}>
            <PortfolioHub />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/project-workspace">
        {() => (
          <ProtectedRoute requiredPermissions={["project:view"]}>
            <ProjectManagerHub />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/pmo-office">
        {() => (
          <ProtectedRoute requiredPermissions={["pmo:governance-review"]}>
            <PMOOffice />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/ai-assistant">
        {() => (
          <ProtectedRoute requiredPermissions={["report:read"]}>
            <AIAssistant />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/project-manager">
        {() => (
          <ProtectedRoute requiredPermissions={["project:view"]}>
            <ProjectManagerHub />
          </ProtectedRoute>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}
