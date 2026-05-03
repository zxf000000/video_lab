"use client"

import * as React from "react"
import { Button as ThemeButton, IconButton, type ButtonProps as ThemeButtonProps, type IconButtonProps } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

type ButtonVariant = "default" | "primary" | "secondary" | "outline" | "ghost" | "inverted" | "destructive" | "link"
type ButtonSize = "default" | "sm" | "lg" | "icon"

interface ButtonProps extends Omit<ThemeButtonProps, "variant" | "size" | "color"> {
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

function mapButtonProps(variant: ButtonVariant, size: ButtonSize) {
  const sizeMap: Record<ButtonSize, NonNullable<ThemeButtonProps["size"]>> = {
    sm: "1",
    default: "2",
    lg: "3",
    icon: "2",
  }

  switch (variant) {
    case "primary":
    case "default":
      return { variant: "solid" as const, color: "cyan" as const, size: sizeMap[size], className: "hover:shadow-glow-strong" }
    case "secondary":
      return { variant: "soft" as const, color: "gray" as const, size: sizeMap[size], className: "" }
    case "outline":
      return { variant: "outline" as const, color: "gray" as const, size: sizeMap[size], className: "border-line hover:border-mint/50 hover:text-mint transition-colors" }
    case "ghost":
      return { variant: "ghost" as const, color: "gray" as const, size: sizeMap[size], className: "hover:bg-panel/5 hover:text-gray-200" }
    case "destructive":
      return { variant: "solid" as const, color: "red" as const, size: sizeMap[size], className: "" }
    case "link":
      return {
        variant: "ghost" as const,
        color: "cyan" as const,
        size: sizeMap[size],
        className: "px-0 underline-offset-4 hover:underline",
      }
    case "inverted":
      return {
        variant: "soft" as const,
        color: "gray" as const,
        size: sizeMap[size],
        className: "bg-cyan-500/10 text-cyan-300 shadow-none ring-1 ring-cyan-500/20 hover:bg-cyan-500/20",
      }
    default:
      return { variant: "solid" as const, color: "cyan" as const, size: sizeMap[size], className: "" }
  }
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "default",
    size = "default",
    type,
    children,
    ...props
  },
  ref
) {
  const mapped = mapButtonProps(variant, size)

  if (size === "icon") {
    return (
      <IconButton
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        data-slot="button"
        type={type ?? "button"}
        radius="large"
        variant={mapped.variant as IconButtonProps["variant"]}
        color={mapped.color}
        size={mapped.size as IconButtonProps["size"]}
        className={cn(mapped.className, className)}
        {...(props as Omit<IconButtonProps, "variant" | "size" | "color">)}
      >
        {children}
      </IconButton>
    )
  }

  return (
    <ThemeButton
      ref={ref}
      data-slot="button"
      type={type ?? "button"}
      radius="large"
      variant={mapped.variant}
      color={mapped.color}
      size={mapped.size}
      className={cn(mapped.className, className)}
      {...props}
    >
      {children}
    </ThemeButton>
  )
})

export { Button }
export type { ButtonProps, ButtonVariant, ButtonSize }
