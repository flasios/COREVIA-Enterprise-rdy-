import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";

type AccentColor = "indigo" | "blue" | "teal" | "violet" | "emerald" | "amber";

type GatewayLayoutProps = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: AccentColor;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
};

const accentConfigs: Record<AccentColor, {
  gradient: string;
  iconBg: string;
  orb1: string;
  orb2: string;
  line: string;
  dot: string;
  glowLight: string;
  glowDark: string;
  primary: string;
  secondary: string;
}> = {
  indigo: {
    gradient: "from-indigo-100 via-indigo-50 to-background dark:from-indigo-950 dark:via-indigo-900/30 dark:to-background",
    iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-600",
    orb1: "bg-indigo-500/20 dark:bg-indigo-500/15",
    orb2: "bg-violet-400/15 dark:bg-violet-400/10",
    line: "via-indigo-500/10 dark:via-indigo-400/20",
    dot: "bg-indigo-500/50 dark:bg-indigo-400/40",
    glowLight: "from-indigo-200/80 via-indigo-100/40",
    glowDark: "dark:from-indigo-500/30 dark:via-indigo-400/10",
    primary: "#6366f1",
    secondary: "#818cf8",
  },
  blue: {
    gradient: "from-blue-100 via-cyan-50 to-background dark:from-blue-950 dark:via-blue-900/30 dark:to-background",
    iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
    orb1: "bg-blue-500/20 dark:bg-blue-500/15",
    orb2: "bg-cyan-400/15 dark:bg-cyan-400/10",
    line: "via-blue-500/10 dark:via-blue-400/20",
    dot: "bg-blue-500/50 dark:bg-blue-400/40",
    glowLight: "from-blue-200/80 via-blue-100/40",
    glowDark: "dark:from-blue-500/30 dark:via-blue-400/10",
    primary: "#3b82f6",
    secondary: "#60a5fa",
  },
  teal: {
    gradient: "from-teal-100 via-emerald-50 to-background dark:from-teal-950 dark:via-teal-900/30 dark:to-background",
    iconBg: "bg-gradient-to-br from-teal-500 to-cyan-600",
    orb1: "bg-teal-500/20 dark:bg-teal-500/15",
    orb2: "bg-cyan-400/15 dark:bg-cyan-400/10",
    line: "via-teal-500/10 dark:via-teal-400/20",
    dot: "bg-teal-500/50 dark:bg-teal-400/40",
    glowLight: "from-teal-200/80 via-teal-100/40",
    glowDark: "dark:from-teal-500/30 dark:via-teal-400/10",
    primary: "#14b8a6",
    secondary: "#2dd4bf",
  },
  violet: {
    gradient: "from-violet-100 via-purple-50 to-background dark:from-violet-950 dark:via-purple-900/30 dark:to-background",
    iconBg: "bg-gradient-to-br from-violet-500 to-purple-600",
    orb1: "bg-violet-500/20 dark:bg-violet-500/15",
    orb2: "bg-fuchsia-400/15 dark:bg-fuchsia-400/10",
    line: "via-violet-500/10 dark:via-violet-400/20",
    dot: "bg-violet-500/50 dark:bg-violet-400/40",
    glowLight: "from-violet-200/80 via-violet-100/40",
    glowDark: "dark:from-violet-500/30 dark:via-violet-400/10",
    primary: "#8b5cf6",
    secondary: "#a78bfa",
  },
  emerald: {
    gradient: "from-emerald-100 via-green-50 to-background dark:from-emerald-950 dark:via-emerald-900/30 dark:to-background",
    iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    orb1: "bg-emerald-500/20 dark:bg-emerald-500/15",
    orb2: "bg-green-400/15 dark:bg-green-400/10",
    line: "via-emerald-500/10 dark:via-emerald-400/20",
    dot: "bg-emerald-500/50 dark:bg-emerald-400/40",
    glowLight: "from-emerald-200/80 via-emerald-100/40",
    glowDark: "dark:from-emerald-500/30 dark:via-emerald-400/10",
    primary: "#10b981",
    secondary: "#34d399",
  },
  amber: {
    gradient: "from-amber-100 via-orange-50 to-background dark:from-amber-950 dark:via-amber-900/30 dark:to-background",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
    orb1: "bg-amber-500/20 dark:bg-amber-500/15",
    orb2: "bg-orange-400/15 dark:bg-orange-400/10",
    line: "via-amber-500/10 dark:via-amber-400/20",
    dot: "bg-amber-500/50 dark:bg-amber-400/40",
    glowLight: "from-amber-200/80 via-amber-100/40",
    glowDark: "dark:from-amber-500/30 dark:via-amber-400/10",
    primary: "#f59e0b",
    secondary: "#fbbf24",
  },
};

function ConstellationBackground({ accent }: { accent: AccentColor }) {
  const config = accentConfigs[accent];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-60"
        style={{ background: config.orb1, top: "10%", left: "5%" }}
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full blur-3xl opacity-40"
        style={{ background: config.orb2, bottom: "20%", right: "10%" }}
        animate={{
          x: [0, -20, 0],
          y: [0, 30, 0],
          scale: [1, 0.9, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />

      {[...Array(3)].map((_, i) => (
        <motion.div
          key={`hline-${i}`}
          className={`absolute h-px bg-gradient-to-r from-transparent ${config.line} to-transparent`}
          style={{
            left: 0,
            right: 0,
            top: `${25 + i * 25}%`,
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            delay: i * 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`vline-${i}`}
          className={`absolute w-px bg-gradient-to-b from-transparent ${config.line} to-transparent`}
          style={{
            left: `${20 + i * 20}%`,
            top: 0,
            bottom: 0,
          }}
          animate={{
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 5,
            delay: i * 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`dot-${i}`}
          className={`absolute w-1.5 h-1.5 rounded-full ${config.dot}`}
          style={{
            left: `${10 + (i * 12)}%`,
            top: `${15 + (i % 3) * 25}%`,
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3,
            delay: i * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function GatewayLayout({
  title,
  subtitle,
  icon,
  accentColor,
  headerActions,
  children,
  testId,
}: GatewayLayoutProps) {
  const config = accentConfigs[accentColor];

  return (
    <div className="min-h-screen bg-background" data-testid={testId}>
      <div className={`relative bg-gradient-to-b ${config.gradient} border-b border-border/50`}>
        <ConstellationBackground accent={accentColor} />

        <div className="relative z-10">
          <div className="px-6 py-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl ${config.iconBg} flex items-center justify-center shadow-lg`}>
                  {icon}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
              </div>
              {headerActions && (
                <div className="flex items-center gap-2">
                  {headerActions}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

export function GatewayStatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp = true,
  accentColor = "blue",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  accentColor?: AccentColor;
}) {
  const iconBgClasses: Record<AccentColor, string> = {
    indigo: "bg-indigo-500/10 text-indigo-500",
    blue: "bg-blue-500/10 text-blue-500",
    teal: "bg-teal-500/10 text-teal-500",
    violet: "bg-violet-500/10 text-violet-500",
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
  };

  return (
    <div
      className="p-4 rounded-xl bg-card border border-border hover-elevate"
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs ${trendUp ? "text-emerald-600" : "text-red-500"}`}>
              <span className={trendUp ? "" : "rotate-180"}>↑</span>
              {trend}
            </div>
          )}
        </div>
        <div className={`h-10 w-10 rounded-xl ${iconBgClasses[accentColor]} flex items-center justify-center`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function GatewaySection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function InnovativeBackground({ accent }: { accent: AccentColor }) {
  const config = accentConfigs[accent];

  const floatingClouds = [
    { x: 5, y: 10, size: 350, delay: 0, duration: 25, opacity: 0.12 },
    { x: 80, y: 5, size: 280, delay: 3, duration: 30, opacity: 0.1 },
    { x: 15, y: 65, size: 400, delay: 1.5, duration: 28, opacity: 0.15 },
    { x: 90, y: 70, size: 320, delay: 2, duration: 22, opacity: 0.08 },
    { x: 45, y: 0, size: 250, delay: 0.5, duration: 35, opacity: 0.1 },
    { x: 60, y: 40, size: 380, delay: 4, duration: 26, opacity: 0.12 },
  ];

  const flowingCurves = [
    { path: "M -50,220 Q 300,180 600,230 T 1200,190 T 1800,240 T 2400,200", duration: 10, delay: 0, position: 'top' },
    { path: "M -50,260 Q 400,220 700,270 T 1300,230 T 1900,280 T 2500,240", duration: 12, delay: 2, position: 'top' },
    { path: "M 2000,720 Q 1600,680 1200,730 T 600,690 T 0,740 T -400,700", duration: 11, delay: 1, position: 'bottom' },
    { path: "M 2000,780 Q 1500,740 1100,790 T 500,750 T -100,800 T -500,760", duration: 13, delay: 3, position: 'bottom' },
  ];

  const particles = Array.from({ length: 25 }, (_, _i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 8,
    duration: Math.random() * 10 + 15,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient}`} />

      <svg className="absolute inset-0 w-full h-full opacity-[0.015] dark:opacity-[0.03]" aria-hidden="true">
        <defs>
          <pattern id="innovativeGrid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="currentColor" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#innovativeGrid)" className="text-foreground" />
      </svg>

      {floatingClouds.map((cloud, i) => (
        <motion.div
          key={`cloud-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${cloud.x}%`,
            top: `${cloud.y}%`,
            width: cloud.size,
            height: cloud.size,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(ellipse at center, rgba(180, 140, 60, ${cloud.opacity}) 0%, rgba(160, 120, 40, ${cloud.opacity * 0.5}) 40%, transparent 70%)`,
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, 60, -40, 30, 0],
            y: [0, -40, 30, -50, 0],
            scale: [1, 1.2, 0.9, 1.15, 1],
          }}
          transition={{
            duration: cloud.duration,
            delay: cloud.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 5 }}>
        <defs>
          <linearGradient id="goldenFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B6914" stopOpacity="0" />
            <stop offset="15%" stopColor="#B8860B" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#DAA520" stopOpacity="0.7" />
            <stop offset="85%" stopColor="#B8860B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8B6914" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="goldenFlowGradDark" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6B5314" stopOpacity="0" />
            <stop offset="15%" stopColor="#9A7B0A" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#C9A227" stopOpacity="0.6" />
            <stop offset="85%" stopColor="#9A7B0A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6B5314" stopOpacity="0" />
          </linearGradient>
          <filter id="glowFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {flowingCurves.map((curve, i) => (
          <g key={`curve-${i}`}>
            <motion.path
              d={curve.path}
              fill="none"
              stroke="url(#goldenFlowGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#glowFilter)"
              className="dark:hidden"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: [0, 1],
                opacity: [0, 0.8, 0.6, 0],
              }}
              transition={{
                duration: curve.duration,
                delay: curve.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.path
              d={curve.path}
              fill="none"
              stroke="url(#goldenFlowGradDark)"
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#glowFilter)"
              className="hidden dark:block"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: [0, 1],
                opacity: [0, 0.7, 0.5, 0],
              }}
              transition={{
                duration: curve.duration,
                delay: curve.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </g>
        ))}
      </svg>

      {particles.map((particle, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            background: 'linear-gradient(135deg, #D4AF37 0%, #C4A35A 50%, #8B7355 100%)',
            boxShadow: '0 0 6px rgba(212, 175, 55, 0.4)',
          }}
          animate={{
            y: [0, -80, -160],
            x: [0, 20, -10],
            opacity: [0, 0.7, 0],
            scale: [0.5, 1.2, 0.3],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}

      <div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(180, 140, 60, 0.08) 0%, rgba(160, 120, 40, 0.04) 50%, transparent 70%)',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(200, 160, 70, 0.06) 0%, rgba(180, 140, 50, 0.03) 50%, transparent 70%)',
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_var(--tw-gradient-from)_100%)] from-background/40 dark:from-background/60" />
    </div>
  );
}

export function GatewayCard({
  title,
  description,
  icon,
  accentColor,
  onClick,
  isActive = true,
  stats,
  testId,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor: AccentColor;
  onClick?: () => void;
  isActive?: boolean;
  stats?: { label: string; value: string | number }[];
  testId?: string;
}) {
  const _config = accentConfigs[accentColor];

  const gradients: Record<AccentColor, string> = {
    indigo: "from-indigo-500 to-indigo-600",
    blue: "from-blue-500 to-cyan-500",
    teal: "from-teal-500 to-emerald-500",
    violet: "from-violet-500 to-purple-500",
    emerald: "from-emerald-500 to-green-500",
    amber: "from-amber-500 to-orange-500",
  };

  const borderGradients: Record<AccentColor, string> = {
    indigo: "hover:border-indigo-400/50 dark:hover:border-indigo-500/40",
    blue: "hover:border-blue-400/50 dark:hover:border-blue-500/40",
    teal: "hover:border-teal-400/50 dark:hover:border-teal-500/40",
    violet: "hover:border-violet-400/50 dark:hover:border-violet-500/40",
    emerald: "hover:border-emerald-400/50 dark:hover:border-emerald-500/40",
    amber: "hover:border-amber-400/50 dark:hover:border-amber-500/40",
  };

  const glowStyles: Record<AccentColor, string> = {
    indigo: "group-hover:shadow-indigo-500/20 dark:group-hover:shadow-indigo-500/10",
    blue: "group-hover:shadow-blue-500/20 dark:group-hover:shadow-blue-500/10",
    teal: "group-hover:shadow-teal-500/20 dark:group-hover:shadow-teal-500/10",
    violet: "group-hover:shadow-violet-500/20 dark:group-hover:shadow-violet-500/10",
    emerald: "group-hover:shadow-emerald-500/20 dark:group-hover:shadow-emerald-500/10",
    amber: "group-hover:shadow-amber-500/20 dark:group-hover:shadow-amber-500/10",
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={!isActive}
      className={`group relative w-full h-full text-left transition-all duration-300 ${
        isActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
      }`}
      whileHover={isActive ? { scale: 1.02, y: -4 } : {}}
      whileTap={isActive ? { scale: 0.98 } : {}}
      data-testid={testId}
    >
      <div className={`relative overflow-hidden rounded-2xl border bg-card/80 dark:bg-card/60 backdrop-blur-xl transition-all duration-500 group-hover:shadow-2xl ${borderGradients[accentColor]} ${glowStyles[accentColor]} border-border/50 h-full flex flex-col`}>
        <div className={`absolute inset-0 bg-gradient-to-br from-${accentColor}-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

        <div className={`h-1 w-full bg-gradient-to-r ${gradients[accentColor]} opacity-80 flex-shrink-0`} />

        <div className="p-5 relative flex-1 flex flex-col">
          <div className="flex items-start gap-4 mb-3">
            <div className={`relative h-12 w-12 flex-shrink-0 rounded-xl bg-gradient-to-br ${gradients[accentColor]} flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}>
              <div className="text-white">
                {icon}
              </div>
              <motion.div
                className="absolute inset-0 rounded-xl bg-white/20"
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors min-h-[1.75rem]">{title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            </div>
          </div>

          {stats && stats.length > 0 && (
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/50 flex-wrap">
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-semibold text-foreground shrink-0">{stat.value}</span>
                  <span className="text-xs text-muted-foreground truncate">{stat.label}</span>
                  {i < stats.length - 1 && <div className="w-px h-4 bg-border ml-1 shrink-0" />}
                </div>
              ))}
            </div>
          )}

          <motion.div
            className="absolute bottom-5 right-5"
            initial={{ opacity: 0, x: -10 }}
            whileHover={{ opacity: 1, x: 0 }}
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.div>
        </div>

        {!isActive && (
          <div className="absolute inset-0 bg-background/80 dark:bg-background/90 flex items-center justify-center backdrop-blur-sm">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/80 border border-border">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Coming Soon</span>
            </div>
          </div>
        )}
      </div>
    </motion.button>
  );
}

export function ConstellationLandingLayout({
  title: _title,
  icon: _icon,
  accentColor,
  children,
  testId,
}: {
  title: string;
  icon: React.ReactNode;
  accentColor: AccentColor;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="h-screen relative overflow-hidden bg-background"
      data-testid={testId}
    >
      <InnovativeBackground accent={accentColor} />

      <div className="relative z-10 h-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
