"use client"

import * as React from "react"
import { cn } from "@/src/lib/utils"

type ButtonVariant = "default" | "primary" | "secondary" | "outline" | "ghost" | "destructive" | "inverted" | "link"
type ButtonSize = "default" | "sm" | "lg" | "icon"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-mint/10 text-mint border border-mint/30 hover:bg-mint/15 hover:border-mint/50 hover:shadow-glow active:bg-mint/20",
  primary:
    "bg-mint text-void font-bold border border-mint hover:bg-mint/90 hover:shadow-glow-strong active:bg-mint/80",
  secondary:
    "bg-panel2 text-gray-300 border border-line hover:bg-panel2/80 hover:border-line/80 hover:text-gray-100 active:bg-panel",
  outline:
    "bg-transparent text-gray-300 border border-line hover:border-mint/40 hover:text-mint active:bg-mint/5",
  ghost:
    "bg-transparent text-gray-500 border border-transparent hover:text-gray-200 hover:bg-panel2/50 active:text-gray-100",
  destructive:
    "bg-red-500/5 text-red-400 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] active:bg-red-500/15",
  inverted:
    "bg-mint/10 text-mint border border-mint/25 hover:bg-mint/15 hover:border-mint/40 hover:shadow-glow active:bg-mint/20",
  link:
    "bg-transparent text-mint/80 border border-transparent underline-offset-4 hover:underline hover:text-mint active:text-mint/60",
}

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-9 px-4 text-sm gap-2",
  sm: "h-8 px-3 text-xs gap-1.5",
  lg: "h-11 px-6 text-base gap-2.5",
  icon: "h-9 w-9 p-0",
}

const clipPathStyles: Record<ButtonSize, string> = {
  default: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
  sm: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
  lg: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
  icon: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", type, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-slot="button"
      type={type ?? "button"}
      className={cn(
        "inline-flex items-center justify-center font-semibold tracking-wider uppercase transition-all duration-150 select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mint/50 focus-visible:ring-offset-1 focus-visible:ring-offset-void disabled:pointer-events-none disabled:opacity-40",
        variantStyles[variant],
        sizeStyles[size],
        size !== "icon" && "rounded-none",
        className,
      )}
      style={size !== "icon" ? { clipPath: clipPathStyles[size] } : undefined}
      {...props}
    >
      {children}
    </button>
  )
})

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
