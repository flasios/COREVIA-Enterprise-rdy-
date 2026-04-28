import { memo, useCallback, useState } from "react";
import { useTranslation } from 'react-i18next';
import { ArrowRight } from "lucide-react";

interface PortalCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  actionText: string;
  actionVariant?: "default" | "secondary" | "outline";
  onAction: () => void;
  onSelect?: () => void;
  color?: string;
  buttonColor?: string;
  usageLevel?: number;
  metrics?: {
    label: string;
    value: string;
    status: string;
  };
}

function PortalCard({
  title,
  description,
  icon,
  features,
  actionText,
  onAction,
  onSelect,
  color = "bg-primary",
  usageLevel = 75,
  metrics
}: PortalCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { t } = useTranslation();

  const handleCardClick = useCallback(() => {
    onSelect?.();
  }, [onSelect]);

  const handleActionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAction();
  }, [onAction]);

  const getThemeColors = () => {
    if (color.includes('blue')) return {
      gradient: 'from-blue-600 via-cyan-500 to-blue-400',
      glow: 'rgba(59, 130, 246, 0.5)',
      accent: '#3b82f6',
      light: 'rgba(59, 130, 246, 0.1)'
    };
    if (color.includes('emerald')) return {
      gradient: 'from-emerald-600 via-teal-500 to-emerald-400',
      glow: 'rgba(16, 185, 129, 0.5)',
      accent: '#10b981',
      light: 'rgba(16, 185, 129, 0.1)'
    };
    if (color.includes('purple')) return {
      gradient: 'from-purple-600 via-violet-500 to-purple-400',
      glow: 'rgba(139, 92, 246, 0.5)',
      accent: '#8b5cf6',
      light: 'rgba(139, 92, 246, 0.1)'
    };
    if (color.includes('amber')) return {
      gradient: 'from-amber-600 via-yellow-500 to-amber-400',
      glow: 'rgba(245, 158, 11, 0.5)',
      accent: '#f59e0b',
      light: 'rgba(245, 158, 11, 0.1)'
    };
    if (color.includes('rose')) return {
      gradient: 'from-rose-600 via-pink-500 to-rose-400',
      glow: 'rgba(244, 63, 94, 0.5)',
      accent: '#f43f5e',
      light: 'rgba(244, 63, 94, 0.1)'
    };
    if (color.includes('indigo')) return {
      gradient: 'from-indigo-600 via-blue-500 to-indigo-400',
      glow: 'rgba(99, 102, 241, 0.5)',
      accent: '#6366f1',
      light: 'rgba(99, 102, 241, 0.1)'
    };
    if (color.includes('teal')) return {
      gradient: 'from-teal-600 via-cyan-500 to-teal-400',
      glow: 'rgba(20, 184, 166, 0.5)',
      accent: '#14b8a6',
      light: 'rgba(20, 184, 166, 0.1)'
    };
    if (color.includes('cyan')) return {
      gradient: 'from-cyan-600 via-sky-500 to-cyan-400',
      glow: 'rgba(6, 182, 212, 0.5)',
      accent: '#06b6d4',
      light: 'rgba(6, 182, 212, 0.1)'
    };
    if (color.includes('violet')) return {
      gradient: 'from-violet-600 via-purple-500 to-violet-400',
      glow: 'rgba(124, 58, 237, 0.5)',
      accent: '#7c3aed',
      light: 'rgba(124, 58, 237, 0.1)'
    };
    if (color.includes('orange')) return {
      gradient: 'from-orange-600 via-amber-500 to-orange-400',
      glow: 'rgba(249, 115, 22, 0.5)',
      accent: '#f97316',
      light: 'rgba(249, 115, 22, 0.1)'
    };
    return {
      gradient: 'from-slate-600 via-slate-500 to-slate-400',
      glow: 'rgba(100, 116, 139, 0.5)',
      accent: '#64748b',
      light: 'rgba(100, 116, 139, 0.1)'
    };
  };

  const theme = getThemeColors();

  return (
    <div
      className="group relative h-full min-h-[220px] cursor-pointer"
      style={{ perspective: '1000px' }}
      data-testid={`card-portal-${title.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Orbital Glow Ring */}
      <div
        className={`absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 blur-xl`}
        style={{
          background: `radial-gradient(ellipse at center, ${theme.glow} 0%, transparent 70%)`,
          transform: isHovered ? 'scale(1.1)' : 'scale(0.9)'
        }}
      />

      {/* Main Card */}
      <div
        className={`relative h-full rounded-2xl overflow-hidden transition-all duration-500 ease-out`}
        style={{
          transform: isHovered ? 'translateY(-8px) rotateX(2deg)' : 'translateY(0) rotateX(0)',
          transformStyle: 'preserve-3d',
          boxShadow: isHovered
            ? `0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1), 0 8px 32px ${theme.glow}`
            : '0 10px 40px -10px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.1)'
        }}
      >
        {/* Glass Background - Ultra Transparent Glassmorphism */}
        <div className="absolute inset-0 bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent dark:from-slate-800/30 dark:via-slate-800/10 dark:to-transparent" />

        {/* Glass Reflections */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent dark:from-white/5 dark:via-transparent dark:to-transparent h-1/3" />

        {/* Animated Aurora Sweep */}
        <div
          className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}
          style={{
            background: `linear-gradient(135deg, transparent 0%, ${theme.light} 25%, transparent 50%, ${theme.light} 75%, transparent 100%)`,
            backgroundSize: '400% 400%',
            animation: isHovered ? 'aurora-sweep 3s ease infinite' : 'none'
          }}
        />

        {/* Top Accent Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient}`} />

        {/* Geometric Pattern Overlay */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={`hex-${title}`} width="30" height="26" patternUnits="userSpaceOnUse">
                <path d="M15 0L30 7.5V22.5L15 30L0 22.5V7.5L15 0Z" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#hex-${title})`}/>
          </svg>
        </div>

        {/* Floating Orbs */}
        <div
          className={`absolute -top-6 -right-6 w-20 h-20 rounded-full transition-all duration-700`}
          style={{
            background: `radial-gradient(circle, ${theme.light} 0%, transparent 70%)`,
            transform: isHovered ? 'translate(-5px, 5px) scale(1.2)' : 'translate(0, 0) scale(1)'
          }}
        />
        <div
          className={`absolute -bottom-10 -left-10 w-24 h-24 rounded-full transition-all duration-700`}
          style={{
            background: `radial-gradient(circle, ${theme.light} 0%, transparent 70%)`,
            transform: isHovered ? 'translate(5px, -5px) scale(1.2)' : 'translate(0, 0) scale(1)'
          }}
        />

        {/* Energy Particles */}
        {isHovered && (
          <>
            <div className="absolute top-8 right-12 w-1 h-1 rounded-full animate-ping" style={{ backgroundColor: theme.accent, animationDuration: '1.5s' }} />
            <div className="absolute top-16 right-8 w-0.5 h-0.5 rounded-full animate-ping" style={{ backgroundColor: theme.accent, animationDuration: '2s', animationDelay: '0.3s' }} />
            <div className="absolute bottom-20 left-10 w-1 h-1 rounded-full animate-ping" style={{ backgroundColor: theme.accent, animationDuration: '1.8s', animationDelay: '0.5s' }} />
          </>
        )}



        {/* Content */}
        <div className="relative z-10 p-4 flex flex-col h-full">
          {/* Icon Hub */}
          <div className="mb-3">
            <div className="relative inline-block">
              {/* Icon Orbit Ring */}
              <div
                className={`absolute -inset-2 rounded-xl border-2 border-dashed transition-all duration-700`}
                style={{
                  borderColor: isHovered ? theme.accent : 'transparent',
                  transform: isHovered ? 'rotate(45deg) scale(1.1)' : 'rotate(0deg) scale(1)',
                  opacity: isHovered ? 0.3 : 0
                }}
              />

              {/* Icon Container */}
              <div
                className={`relative w-11 h-11 rounded-lg flex items-center justify-center text-white shadow-lg transition-all duration-500 bg-gradient-to-br ${theme.gradient}`}
                style={{
                  boxShadow: isHovered ? `0 8px 30px ${theme.glow}` : `0 4px 12px ${theme.glow}`,
                  transform: isHovered ? 'scale(1.1) rotate(-3deg)' : 'scale(1) rotate(0deg)'
                }}
              >
                <div className="text-base">{icon}</div>
              </div>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-bold text-sm mb-1 text-slate-800 dark:text-white leading-tight">
            {title}
          </h3>

          {/* Description */}
          <p className={`text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2 transition-all duration-300 ${isHovered ? 'opacity-100' : 'opacity-70'}`}>
            {description}
          </p>

          {/* Highlights */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {t('dashboard.portalCard.highlights')}
            </div>
            <div className="space-y-1">
              {features.slice(0, 3).map((feature) => (
                <div key={feature} className="flex items-start gap-1.5">
                  <span
                    className="mt-1 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: theme.accent }}
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Metrics Display */}
          <div className="space-y-2">
            {metrics ? (
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: theme.light }}>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br ${theme.gradient}`}
                  style={{ boxShadow: `0 3px 10px ${theme.glow}` }}
                >
                  <span className="text-sm font-bold text-white">{metrics.value}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{metrics.label}</div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{metrics.status}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t('dashboard.portalCard.activity')}</span>
                  <span
                    className="text-xs font-bold"
                    style={{ color: theme.accent }}
                  >{usageLevel}%</span>
                </div>
                <div className="relative h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${theme.gradient} transition-all duration-700`}
                    style={{ width: `${usageLevel}%` }}
                  />
                  {/* Shimmer Effect */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                      animation: isHovered ? 'shimmer 2s infinite' : 'none',
                      transform: 'skewX(-20deg)'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              className={`relative w-full py-2 px-4 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 overflow-hidden transition-all duration-300 hover:shadow-lg active:scale-[0.98] group/btn bg-gradient-to-r ${theme.gradient}`}
              style={{ boxShadow: `0 3px 15px ${theme.glow}` }}
              onClick={handleActionClick}
              data-testid={`button-${actionText.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {/* Button Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />

              <span className="relative z-10">{actionText}</span>
              <ArrowRight className="w-3 h-3 relative z-10 transition-transform duration-300 group-hover/btn:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Glass Border Effect */}
        <div
          className={`absolute inset-0 rounded-2xl pointer-events-none transition-all duration-500`}
          style={{
            boxShadow: `
              inset 0 0 0 1px ${isHovered ? theme.accent + '50' : 'rgba(255,255,255,0.2)'},
              inset 0 1px 0 0 rgba(255,255,255,0.3),
              inset 0 -1px 0 0 rgba(0,0,0,0.05)
            `,
            opacity: 1
          }}
        />
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes aurora-sweep {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }
      `}</style>
    </div>
  );
}

export default memo(PortalCard);
