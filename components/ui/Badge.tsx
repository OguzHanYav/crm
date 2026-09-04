import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "./cn";

type Tone = "default" | "accent" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground border border-border",
  accent: "bg-accent-soft text-accent border border-accent/30",
  success: "bg-success-soft text-success border border-success/30",
  warning: "bg-warning-soft text-warning border border-warning/30",
  danger: "bg-danger-soft text-danger border border-danger/30",
  info: "bg-info-soft text-info border border-info/30",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export const STATUS_TONE_MAP: Record<string, Tone> = {
  Lead: "info",
  "In Kontakt": "warning",
  Kunde: "success",
  Verloren: "danger",
};
