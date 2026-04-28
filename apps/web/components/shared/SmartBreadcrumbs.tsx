import { useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from "wouter";
import { Home, ChevronRight, Shield, FileText, Briefcase, BookOpen, Network, FileCheck, Cable, Sparkles } from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

/* ── Route → Breadcrumb Map ── */
interface BreadcrumbSegment {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const ROUTE_MAP: Record<string, { label: string; icon?: React.ReactNode; parent?: string }> = {
  "": { label: "Home", icon: <Home className="h-3.5 w-3.5" /> },
  "brain-console": { label: "Corevia Brain", icon: <HexagonLogoFrame px={14} /> },
  "decisions": { label: "Decisions" },
  "intelligence": { label: "Engine Hub" },
  "new": { label: "New Intake" },
  "services": { label: "Services" },
  "agents": { label: "Agents" },
  "policies": { label: "Policies" },
  "audit-trail": { label: "Audit Trail" },
  "learning": { label: "Learning Vault" },
  "ai-assistant": { label: "AI Assistant" },
  "intelligent-gateway": { label: "Intelligent Gateway", icon: <Shield className="h-3.5 w-3.5" /> },
  "intelligent-workspace": { label: "Intelligent Workspace", icon: <Sparkles className="h-3.5 w-3.5" /> },
  "intelligent-library": { label: "Intelligent Library", icon: <FileText className="h-3.5 w-3.5" /> },
  "intelligent-portfolio": { label: "Portfolio Gateway", icon: <Briefcase className="h-3.5 w-3.5" /> },
  "knowledge-centre": { label: "Knowledge Centre", icon: <BookOpen className="h-3.5 w-3.5" /> },
  "knowledge-hub": { label: "Knowledge Hub", icon: <BookOpen className="h-3.5 w-3.5" /> },
  "synergies": { label: "Synergies", icon: <Network className="h-3.5 w-3.5" /> },
  "tenders": { label: "Tenders", icon: <FileCheck className="h-3.5 w-3.5" /> },
  "integration-hub": { label: "Integration Hub", icon: <Cable className="h-3.5 w-3.5" /> },
  "demand-home": { label: "Demand Home" },
  "demand-intake": { label: "Demand Intake" },
  "demand-analysis": { label: "Demand Analysis" },
  "demand-reports": { label: "Demand Reports" },
  "demand-submitted": { label: "Submitted Demands" },
  "portfolio": { label: "Portfolio" },
  "portfolio-hub": { label: "Portfolio Hub", icon: <Briefcase className="h-3.5 w-3.5" /> },
  "portfolio-gateway": { label: "Portfolio Gateway", icon: <Briefcase className="h-3.5 w-3.5" /> },
  "project": { label: "Project Workspace" },
  "project-approval": { label: "Project Approval" },
  "performance": { label: "Performance" },
  "performance-reporting": { label: "Performance Reporting" },
  "admin": { label: "Admin" },
  "users": { label: "Users" },
  "teams": { label: "Teams" },
  "risk-management": { label: "Risk Management" },
  "compliance": { label: "Compliance" },
  "compliance-tracking": { label: "Compliance Tracking" },
  "quality-assurance": { label: "Quality Assurance", icon: <FileCheck className="h-3.5 w-3.5" /> },
  "resource-allocation": { label: "Resources" },
  "system-monitoring": { label: "System Monitor" },
  "dlp": { label: "DLP Dashboard" },
  "pmo-office": { label: "PMO Office" },
  "project-manager": { label: "Project Manager" },
  "project-workspace": { label: "Project Workspace" },
  "ea-registry": { label: "EA Registry" },
  "capabilities": { label: "Capabilities" },
  "applications": { label: "Applications" },
  "data-domains": { label: "Data Domains" },
  "technology": { label: "Technology Standards" },
  "integrations": { label: "Integrations" },
};

function isUUID(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}

function isNumeric(segment: string): boolean {
  return /^\d+$/.test(segment);
}

export function SmartBreadcrumbs() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const breadcrumbs: BreadcrumbSegment[] = useMemo(() => {
    if (location === "/" || location === "") {
      return [{ label: t('nav.breadcrumbs.home'), href: "/", icon: <Home className="h-3.5 w-3.5" /> }];
    }

    const segments = location.split("/").filter(Boolean);
    const crumbs: BreadcrumbSegment[] = [
      { label: t('nav.breadcrumbs.home'), href: "/", icon: <Home className="h-3.5 w-3.5" /> },
    ];

    let currentPath = "";
    for (const segment of segments) {
      currentPath += `/${segment}`;

      // Skip UUIDs and numeric IDs - they're part of the previous segment
      if (isUUID(segment) || isNumeric(segment)) {
        if (crumbs.length > 0) {
          const prev = crumbs.at(-1);
          if (prev) {
            prev.label = `${prev.label} #${segment.slice(0, 8)}`;
            prev.href = currentPath;
          }
        }
        continue;
      }

      const routeInfo = ROUTE_MAP[segment];
      crumbs.push({
        label: routeInfo?.label ? t(`nav.breadcrumbs.${segment}`, { defaultValue: routeInfo.label }) : segment.replaceAll('-', " ").replaceAll(/\b\w/g, (c) => c.toUpperCase()),
        href: currentPath,
        icon: routeInfo?.icon,
      });
    }

    return crumbs;
  }, [location, t]);

  // Don't show breadcrumbs on home, login/register, or full-screen pages
  if (
    location === "/" ||
    location === "/login" ||
    location === "/register" ||
    location === "/demand-analysis" ||
    breadcrumbs.length <= 1
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-sm"
      data-testid="breadcrumb-nav"
    >
      <ol className="flex items-center gap-1 flex-wrap">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
              {isLast ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  {crumb.icon && <span className="text-primary">{crumb.icon}</span>}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.icon}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
