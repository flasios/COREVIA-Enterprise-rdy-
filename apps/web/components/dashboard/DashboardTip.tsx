import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Sparkles, ChevronLeft, ChevronRight, Shield, Layers } from "lucide-react";
import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

const tips = [
  {
    icon: Sparkles,
    textKey: "dashboard.tip.intelligence",
    gradient: "from-violet-400 via-fuchsia-400 to-indigo-400"
  },
  {
    icon: Shield,
    textKey: "dashboard.tip.governed",
    gradient: "from-cyan-400 via-violet-400 to-purple-400"
  },
  {
    icon: (_props: { className?: string }) => <HexagonLogoFrame px={20} />,
    textKey: "dashboard.tip.insight",
    gradient: "from-emerald-400 via-cyan-400 to-violet-400"
  },
  {
    icon: Layers,
    textKey: "dashboard.tip.unified",
    gradient: "from-amber-400 via-orange-400 to-rose-400"
  }
];

export default function DashboardTip() {
  const { t } = useTranslation();
  const [currentTip, setCurrentTip] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentTip((prev) => (prev + 1) % tips.length);
        setIsAnimating(false);
      }, 400);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const goToPrev = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentTip((prev) => (prev - 1 + tips.length) % tips.length);
      setIsAnimating(false);
    }, 200);
  };

  const goToNext = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
      setIsAnimating(false);
    }, 200);
  };

  const tip = tips[currentTip]!;
  const Icon = tip.icon;

  return (
    <div
      className="group relative flex items-center gap-4 px-5 py-3 rounded-2xl bg-card dark:bg-slate-900/80 border border-border dark:border-violet-500/20 overflow-hidden shadow-lg dark:shadow-violet-500/5"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      data-testid="dashboard-tip"
    >
      {/* Animated Aurora Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -inset-[100%] bg-gradient-to-r ${tip.gradient} opacity-[0.05] dark:opacity-[0.08] blur-3xl animate-pulse`} style={{ animationDuration: '4s' }} />
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-[10%] w-1 h-1 bg-violet-400/40 dark:bg-violet-400/60 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute top-1/3 left-[30%] w-0.5 h-0.5 bg-cyan-400/40 dark:bg-cyan-400/60 rounded-full animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
        <div className="absolute top-2/3 left-[60%] w-1 h-1 bg-fuchsia-400/40 dark:bg-fuchsia-400/60 rounded-full animate-ping" style={{ animationDuration: '2.5s', animationDelay: '1s' }} />
        <div className="absolute top-1/4 left-[80%] w-0.5 h-0.5 bg-indigo-400/40 dark:bg-indigo-400/60 rounded-full animate-ping" style={{ animationDuration: '3.5s', animationDelay: '0.3s' }} />
      </div>

      {/* Shimmer Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] dark:via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1500 ease-in-out" />

      {/* Navigation - Previous */}
      <button
        onClick={goToPrev}
        className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 dark:bg-white/5 backdrop-blur-sm border border-border dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-violet-500/20 hover:border-primary/30 transition-all duration-300 hover:scale-110"
        data-testid="button-tip-prev"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Icon with Glow */}
      <div className="relative">
        <div className={`absolute inset-0 bg-gradient-to-br ${tip.gradient} rounded-xl blur-lg opacity-30 dark:opacity-50 transition-all duration-500 ${isAnimating ? 'scale-50 opacity-0' : 'scale-100'}`} />
        <div
          className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${tip.gradient} text-white shadow-lg transition-all duration-400 ${isAnimating ? 'scale-50 opacity-0 rotate-180' : 'scale-100 opacity-100 rotate-0'}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Tip Text with Gradient */}
      <div className={`relative z-10 flex-1 transition-all duration-400 ${isAnimating ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
        <p className={`text-sm font-semibold tracking-wide bg-gradient-to-r ${tip.gradient} bg-clip-text text-transparent`}>
          {t(tip.textKey)}
        </p>
      </div>

      {/* Progress Bar & Dots */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {tips.map((t, index) => (
            <button
              key={index}
              onClick={() => {
                setIsAnimating(true);
                setTimeout(() => {
                  setCurrentTip(index);
                  setIsAnimating(false);
                }, 200);
              }}
              className={`relative transition-all duration-300 ${
                index === currentTip
                  ? 'w-6 h-2'
                  : 'w-2 h-2 hover:scale-125'
              }`}
              data-testid={`button-tip-dot-${index}`}
            >
              <div className={`absolute inset-0 rounded-full transition-all duration-300 ${
                index === currentTip
                  ? `bg-gradient-to-r ${tip.gradient}`
                  : 'bg-muted-foreground/20 hover:bg-muted-foreground/40'
              }`} />
              {index === currentTip && (
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${tip.gradient} animate-pulse opacity-50`} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation - Next */}
      <button
        onClick={goToNext}
        className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 dark:bg-white/5 backdrop-blur-sm border border-border dark:border-white/10 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-violet-500/20 hover:border-primary/30 transition-all duration-300 hover:scale-110"
        data-testid="button-tip-next"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Corner Accent */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-violet-500/5 dark:from-violet-500/10 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-12 h-12 bg-gradient-to-tr from-indigo-500/5 dark:from-indigo-500/10 to-transparent rounded-tr-full" />
    </div>
  );
}
