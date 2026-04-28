import { useState } from 'react';
import { 
  Rocket, Map, Settings2, Activity, Trophy,
  X, ChevronRight, Lock, CheckCircle2 as _CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

interface PhaseSelectorProps {
  currentPhase: string;
  activePhase: string;
  onPhaseSelect: (phase: string) => void;
  phaseReadiness?: number;
  unlockedPhases?: string[];
}

const PHASES = [
  { id: 'initiation', label: 'Initiation', icon: Rocket, description: 'Charter & Scope' },
  { id: 'planning', label: 'Planning', icon: Map, description: 'WBS & Resources' },
  { id: 'execution', label: 'Execution', icon: Settings2, description: 'Delivery & Build' },
  { id: 'monitoring', label: 'Monitoring', icon: Activity, description: 'Track & Control' },
  { id: 'closure', label: 'Closure', icon: Trophy, description: 'Handover & Close' },
];

function PhaseNavigatorModal({
  isOpen,
  onClose,
  phases,
  activePhase,
  currentPhase,
  onPhaseSelect,
  unlockedPhases,
}: {
  isOpen: boolean;
  onClose: () => void;
  phases: typeof PHASES;
  activePhase: string;
  currentPhase: string;
  onPhaseSelect: (id: string) => void;
  unlockedPhases: string[];
}) {
  if (!isOpen) return null;

  const currentIndex = phases.findIndex(p => p.id === currentPhase);

  const getStatus = (phaseId: string) => {
    const index = phases.findIndex(p => p.id === phaseId);
    if (index < currentIndex) return 'completed';
    if (phaseId === currentPhase) return 'active';
    return 'upcoming';
  };
  
  const isLocked = (phaseId: string) => !unlockedPhases.includes(phaseId);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      <div className="relative z-10 w-[90vw] max-w-[900px] mx-auto">
        <div className="relative bg-gradient-to-br from-card/95 via-card/90 to-card/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-emerald-500/5" />
          
          <div className="relative p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold">Phase Navigator</h2>
                <p className="text-sm text-muted-foreground">
                  Select a phase to view
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all"
                data-testid="modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-5 gap-4">
              {phases.map((phase) => {
                const status = getStatus(phase.id);
                const isSelected = activePhase === phase.id;
                const locked = isLocked(phase.id);
                const PhaseIcon = phase.icon;
                
                return (
                  <button
                    key={phase.id}
                    onClick={() => !locked && onPhaseSelect(phase.id)}
                    disabled={locked}
                    className={cn(
                      "relative flex flex-col items-center p-5 rounded-2xl transition-all duration-200",
                      "bg-gradient-to-br backdrop-blur-xl border",
                      locked && "opacity-50 cursor-not-allowed",
                      !locked && "hover:scale-105 hover:-translate-y-1",
                      isSelected && !locked && "from-primary/20 via-primary/10 to-primary/5 border-primary/50 shadow-xl shadow-primary/20",
                      !isSelected && !locked && "from-white/5 to-white/0 border-white/10 hover:border-white/20 hover:from-white/10",
                      locked && "from-muted/30 to-muted/10 border-muted/30"
                    )}
                    data-testid={`phase-option-${phase.id}`}
                  >
                    {locked && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    {isSelected && !locked && (
                      <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/40 shadow-lg shadow-primary/20" />
                    )}
                    
                    <div className={cn(
                      "relative w-16 h-16 rounded-2xl flex items-center justify-center",
                      "transition-all duration-300",
                      locked && "bg-gradient-to-br from-muted/60 to-muted/40",
                      !locked && status === 'completed' && "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40",
                      !locked && status === 'active' && "bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg shadow-primary/40",
                      !locked && status === 'upcoming' && "bg-gradient-to-br from-muted/80 to-muted/60"
                    )}>
                      <PhaseIcon className={cn(
                        "w-8 h-8",
                        locked ? "text-muted-foreground/50" : status === 'upcoming' ? "text-muted-foreground" : "text-white"
                      )} />
                    </div>
                    
                    <span className={cn(
                      "text-sm font-semibold mt-4 transition-colors",
                      locked && "text-muted-foreground",
                      !locked && isSelected && "text-primary",
                      !locked && !isSelected && "text-foreground"
                    )}>
                      {phase.label}
                    </span>
                    
                    <p className="text-[10px] text-muted-foreground text-center mt-2 leading-tight min-h-[40px]">
                      {locked ? "Complete previous gate to unlock" : phase.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export function PhaseSelector({
  currentPhase,
  activePhase,
  onPhaseSelect,
  phaseReadiness = 0,
  unlockedPhases = ['initiation', 'planning', 'execution', 'monitoring', 'closure'],
}: PhaseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentIndex = PHASES.findIndex(p => p.id === currentPhase);
  const activePhaseData = PHASES.find(p => p.id === activePhase);
  const ActiveIcon = activePhaseData?.icon || Rocket;
  
  const getStatus = (phaseId: string) => {
    const index = PHASES.findIndex(p => p.id === phaseId);
    if (index < currentIndex) return 'completed';
    if (phaseId === currentPhase) return 'active';
    return 'upcoming';
  };

  const activeStatus = getStatus(activePhase);
  
  const handlePhaseSelect = (phaseId: string) => {
    // Prevent selection of locked phases
    if (!unlockedPhases.includes(phaseId)) return;
    onPhaseSelect(phaseId);
    setTimeout(() => setIsOpen(false), 100);
  };

  return (
    <div className="relative flex items-center gap-3" data-testid="phase-selector">
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200",
          "bg-card border border-border shadow-md",
          "hover:shadow-lg hover:border-primary/30 hover:scale-[1.02]",
          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-1"
        )}
        data-testid="phase-selector-trigger"
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
          activeStatus === 'completed' && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          activeStatus === 'active' && "bg-primary/15 text-primary",
          activeStatus === 'upcoming' && "bg-muted text-muted-foreground"
        )}>
          <ActiveIcon className="w-4 h-4" />
        </div>
        
        <div className="flex-1 text-left min-w-[100px]">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{activePhaseData?.label}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex gap-0.5">
              {PHASES.map((phase) => {
                const status = getStatus(phase.id);
                return (
                  <div
                    key={phase.id}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      status === 'completed' && "bg-emerald-500",
                      status === 'active' && "bg-primary",
                      status === 'upcoming' && "bg-muted-foreground/30"
                    )}
                  />
                );
              })}
            </div>
            <span className="text-[10px] text-muted-foreground">Readiness {phaseReadiness}%</span>
          </div>
        </div>
        
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      <PhaseNavigatorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        phases={PHASES}
        activePhase={activePhase}
        currentPhase={currentPhase}
        onPhaseSelect={handlePhaseSelect}
        unlockedPhases={unlockedPhases}
      />
    </div>
  );
}
