interface HexagonLogoFrameProps {
  size?: "sm" | "md" | "lg" | "xl";
  px?: number;
  animated?: boolean;
  className?: string;
}

const sizePx: Record<string, number> = { sm: 44, md: 56, lg: 80, xl: 120 };
const sizeClasses: Record<string, string> = {
  sm: "w-11 h-11",
  md: "w-14 h-14",
  lg: "w-20 h-20",
  xl: "w-[120px] h-[120px]",
};

export default function HexagonLogoFrame({
  size = "md",
  px: customPx,
  animated = false,
  className = "",
}: HexagonLogoFrameProps) {
  const resolvedPx = customPx ?? sizePx[size] ?? 56;
  const containerClass = customPx ? "" : (sizeClasses[size] ?? "w-14 h-14");
  const containerStyle = customPx
    ? { width: customPx, height: customPx }
    : undefined;

  return (
    <div
      className={`relative flex-shrink-0 inline-flex items-center justify-center ${containerClass} ${className}`}
      style={containerStyle}
    >
      {/* Outer glow ring */}
      {animated && (
        <div
          className="absolute inset-[-4px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)",
            animation: "cvPulse 3s ease-in-out infinite",
          }}
        />
      )}

      {/* Logo image */}
      <img
        src="/corevia-logo.png"
        alt="COREVIA"
        width={resolvedPx}
        height={resolvedPx}
        className={`object-contain drop-shadow-lg${
          animated ? " cv-logo-float" : ""
        }`}
        style={{
          filter: animated
            ? "drop-shadow(0 0 6px rgba(14,165,233,0.3))"
            : "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
        }}
        draggable={false}
      />

      {animated && (
        <style>{`
          @keyframes cvPulse {
            0%, 100% {
              opacity: 0.5;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.08);
            }
          }
          .cv-logo-float {
            animation: cvFloat 5s ease-in-out infinite;
          }
          @keyframes cvFloat {
            0%, 100% {
              transform: translateY(0px);
              filter: drop-shadow(0 0 6px rgba(14,165,233,0.3));
            }
            50% {
              transform: translateY(-3px);
              filter: drop-shadow(0 0 12px rgba(14,165,233,0.45));
            }
          }
        `}</style>
      )}
    </div>
  );
}
