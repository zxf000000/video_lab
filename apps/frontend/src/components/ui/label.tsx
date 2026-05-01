"use client"

import * as React from "react"
import { Text } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & { className?: string }

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label({ className, children, ...props }, ref) {
  return (
    <Text asChild size="2" weight="medium">
      <label
        ref={ref}
        data-slot="label"
        className={cn(
          "flex items-center gap-2 leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </label>
    </Text>
  )
})

export { Label }
