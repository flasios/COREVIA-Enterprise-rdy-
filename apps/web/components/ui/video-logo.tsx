import HexagonLogoFrame from "@/components/shared/misc/HexagonLogoFrame";

interface VideoLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap: Record<string, "sm" | "md" | "lg" | "xl"> = {
  sm: "md",
  md: "lg",
  lg: "xl",
};

export function VideoLogo({ size = "lg", className = "" }: VideoLogoProps) {
  return (
    <HexagonLogoFrame size={sizeMap[size] ?? "xl"} animated className={className} />
  );
}
