"use client"

import * as React from "react"
import { cn } from "@/src/lib/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-mint/10 text-mint border border-mint/20",
  secondary:
    "bg-panel2 text-gray-400 border border-line",
  destructive:
    "bg-red-500/10 text-red-400 border border-red-500/20",
  outline:
    "bg-transparent text-mint/80 border border-mint/30",
  ghost:
    "bg-transparent text-gray-500 border border-transparent",
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[11px] font-semibold tracking-wider uppercase transition-colors",
        variantStyles[variant],
        className,
      )}
      style={{ clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)" }}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
export type { BadgeProps, BadgeVariant }
