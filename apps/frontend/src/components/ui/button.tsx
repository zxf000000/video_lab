import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/src/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border text-sm font-medium whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-mint bg-mint text-white hover:opacity-90",
        primary: "border-mint bg-mint text-white hover:opacity-90",
        secondary: "border-line bg-panel2 text-slate-700 hover:border-mint hover:text-mint",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground",
        ghost: "border-transparent bg-transparent text-slate-600 hover:bg-panel2 hover:text-slate-900",
        inverted: "border-white/20 bg-white/10 text-white hover:bg-white/15",
        destructive: "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
        link: "border-transparent bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-auto px-4 py-3",
        sm: "px-3 py-2 text-xs",
        lg: "px-6 py-4 text-base",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

interface ButtonProps extends React.ComponentPropsWithoutRef<typeof ButtonPrimitive> {
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants }
export type { ButtonProps, ButtonVariant, ButtonSize }
