import { useState, useCallback } from "react";
import { 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Activity,
  AlertCircle,
  Info,
  Bell,
  TrendingUp
} from "lucide-react";

export interface SystemHealth {
  service: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: number;
  latency: number;
}

export interface Notification {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface WorkflowMetric {
  name: string;
  current: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
}

// Static data - could be moved to a service/API in the future
const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'info',
    title: 'System Update Scheduled',
    message: 'Maintenance window planned for 2:00 AM - 4:00 AM UTC',
    timestamp: '2 hours ago',
    acknowledged: false
  },
  {
    id: '2', 
    type: 'warning',
    title: 'High API Usage',
    message: 'OpenAI API usage at 85% of monthly quota',
    timestamp: '1 hour ago',
    acknowledged: false
  },
  {
    id: '3',
    type: 'critical',
    title: 'Database Connection Pool',
    message: 'Connection pool approaching capacity limits',
    timestamp: '30 minutes ago',
    acknowledged: true
  }
];

const SYSTEM_HEALTH_DATA: SystemHealth[] = [
  { service: 'Authentication Service', status: 'operational', uptime: 99.9, latency: 120 },
  { service: 'Database Cluster', status: 'operational', uptime: 99.8, latency: 45 },
  { service: 'AI Processing Engine', status: 'degraded', uptime: 97.2, latency: 340 },
  { service: 'Email Notifications', status: 'operational', uptime: 99.5, latency: 180 },
  { service: 'Report Generation', status: 'operational', uptime: 98.9, latency: 890 }
];

const WORKFLOW_METRICS_DATA: WorkflowMetric[] = [
  { name: 'Reports Processed', current: 147, target: 150, trend: 'up' },
  { name: 'Avg Processing Time', current: 3.2, target: 4.0, trend: 'down' },
  { name: 'User Satisfaction', current: 94, target: 90, trend: 'up' },
  { name: 'SLA Compliance', current: 98.7, target: 95.0, trend: 'stable' }
];

export function useSystemMonitoring() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [systemHealth] = useState<SystemHealth[]>(SYSTEM_HEALTH_DATA);
  const [workflowMetrics] = useState<WorkflowMetric[]>(WORKFLOW_METRICS_DATA);

  const acknowledgeNotification = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, acknowledged: true } : notif
      )
    );
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-500/10 text-green-700 border-green-200 dark:text-green-400';
      case 'degraded': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-400';
      case 'outage': return 'bg-red-500/10 text-red-700 border-red-200 dark:text-red-400';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200 dark:text-gray-400';
    }
  }, []);

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'operational': return { component: CheckCircle, className: "h-4 w-4" };
      case 'degraded': return { component: AlertTriangle, className: "h-4 w-4" };
      case 'outage': return { component: X, className: "h-4 w-4" };
      default: return { component: Activity, className: "h-4 w-4" };
    }
  }, []);

  const getNotificationIcon = useCallback((type: string) => {
    switch (type) {
      case 'critical': return { component: AlertCircle, className: "h-4 w-4" };
      case 'warning': return { component: AlertTriangle, className: "h-4 w-4" };
      case 'info': return { component: Info, className: "h-4 w-4" };
      default: return { component: Bell, className: "h-4 w-4" };
    }
  }, []);

  const getNotificationColor = useCallback((type: string) => {
    switch (type) {
      case 'critical': return 'border-l-red-500 bg-red-500/5';
      case 'warning': return 'border-l-yellow-500 bg-yellow-500/5';
      case 'info': return 'border-l-blue-500 bg-blue-500/5';
      default: return 'border-l-gray-500 bg-gray-500/5';
    }
  }, []);

  const getTrendIcon = useCallback((trend: string) => {
    switch (trend) {
      case 'up': return { component: TrendingUp, className: "h-3 w-3 text-green-500" };
      case 'down': return { component: TrendingUp, className: "h-3 w-3 text-red-500 rotate-180" };
      case 'stable': return { element: 'div', className: "h-3 w-3 rounded-full bg-blue-500" };
      default: return null;
    }
  }, []);

  return {
    notifications,
    systemHealth,
    workflowMetrics,
    acknowledgeNotification,
    getStatusColor,
    getStatusIcon,
    getNotificationIcon,
    getNotificationColor,
    getTrendIcon
  };
}