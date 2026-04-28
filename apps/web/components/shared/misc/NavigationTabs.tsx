import { useState, useCallback, memo } from "react";
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Home, 
  Brain, 
  FileText, 
  Briefcase, 
  BookOpen, 
  BarChart3, 
  PieChart,
  Users,
  DollarSign,
  GraduationCap,
  Target,
  Bot,
  Menu
} from "lucide-react";

interface NavigationTabsProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const NAVIGATION_TABS = [
  { id: "home", labelKey: "nav.tabs.home", icon: Home },
  { id: "intelligent", labelKey: "nav.tabs.intelligentGateway", icon: Brain },
  { id: "reports", labelKey: "nav.tabs.reports", icon: FileText },
  { id: "assessment", labelKey: "nav.tabs.assessment", icon: Target },
  { id: "library", labelKey: "nav.tabs.library", icon: BookOpen },
  { id: "portfolio", labelKey: "nav.tabs.portfolio", icon: Briefcase },
  { id: "knowledge", labelKey: "nav.tabs.knowledge", icon: GraduationCap },
  { id: "benchmark", labelKey: "nav.tabs.benchmark", icon: BarChart3 },
  { id: "brd", labelKey: "nav.tabs.brdGeneration", icon: PieChart },
  { id: "access", labelKey: "nav.tabs.accessManagement", icon: Users },
  { id: "learning", labelKey: "nav.tabs.learning", icon: GraduationCap },
  { id: "ai-assistant", labelKey: "nav.tabs.aiAssistant", icon: Bot },
  { id: "pricing", labelKey: "nav.tabs.pricing", icon: DollarSign }
] as const;

function NavigationTabs({ activeTab = "home", onTabChange }: NavigationTabsProps) {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const handleTabClick = useCallback((tabId: string) => {
    setCurrentTab(tabId);
    onTabChange?.(tabId);
  }, [onTabChange]);

  const handleMenuToggle = useCallback(() => {
    setIsMenuVisible(prev => !prev);
  }, []);

  return (
    <nav className="bg-background border-b" data-testid="navigation-tabs">
      <div className="flex items-center px-3 py-1 gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-6 w-6"
          onClick={handleMenuToggle}
          data-testid="button-toggle-menu"
        >
          <Menu className="h-3 w-3" />
        </Button>

        {isMenuVisible && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAVIGATION_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleTabClick(tab.id)}
                  className="shrink-0 gap-1 h-6 px-2 text-xs"
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                  {tab.id === "ai-assistant" && (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
                      {t('nav.tabs.new')}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

export default memo(NavigationTabs);