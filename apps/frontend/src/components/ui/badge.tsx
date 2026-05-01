"use client"

import * as React from "react"
import { Badge as ThemeBadge, type BadgeProps as ThemeBadgeProps } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost"

interface BadgeProps extends Omit<ThemeBadgeProps, "variant" | "color"> {
  className?: string
  variant?: BadgeVariant
}

function mapBadgeProps(variant: BadgeVariant) {
  switch (variant) {
    case "secondary":
      return { variant: "soft" as const, color: "gray" as const }
    case "destructive":
      return { variant: "soft" as const, color: "red" as const }
    case "outline":
      return { variant: "outline" as const, color: "gray" as const }
    case "ghost":
      return { variant: "surface" as const, color: "gray" as const }
    default:
      return { variant: "solid" as const, color: "iris" as const }
  }
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const mapped = mapBadgeProps(variant)
  return (
    <ThemeBadge data-slot="badge" radius="full" {...mapped} className={cn(className)} {...props}>
      {children}
    </ThemeBadge>
  )
}

export { Badge }
export type { BadgeProps, BadgeVariant }
