import type { LucideIcon } from "lucide-react";

export const tones = {
  orange: "from-[#ff8a1f] to-[#ffb54d]",
  pink: "from-[#f0457f] to-[#ff7aa8]",
  violet: "from-[#7c5ce6] to-[#a07bff]",
  green: "from-[#1fbf6b] to-[#52d98d]",
  blue: "from-[#2f73e8] to-[#55a1ff]",
  teal: "from-[#10a99a] to-[#3fd1c0]",
  red: "from-[#e5384f] to-[#ff6f83]",
} as const;

export type Tone = keyof typeof tones;

export function GradientIcon({
  icon: Icon,
  tone,
  className = "size-10 rounded-xl",
  iconClass = "size-5",
}: {
  icon: LucideIcon;
  tone: Tone;
  className?: string;
  iconClass?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-lg shadow-black/10 ${tones[tone]} ${className}`}
    >
      <Icon className={iconClass} strokeWidth={2.2} />
    </span>
  );
}
