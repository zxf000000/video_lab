"use client"

import * as React from "react"
import { TextField } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

type InputProps = React.ComponentPropsWithoutRef<typeof TextField.Root> & {
  className?: string
  type?: "date" | "datetime-local" | "email" | "hidden" | "month" | "number" | "password" | "search" | "tel" | "text" | "time" | "url" | "week"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...props },
  ref
) {
  return (
    <TextField.Root
      ref={ref}
      type={type}
      data-slot="input"
      radius="large"
      variant="surface"
      size="3"
      className={cn("w-full", className)}
      {...props}
    />
  )
})

export { Input }
