"use client"

import * as React from "react"
import { TextArea as ThemeTextArea } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

type TextareaProps = React.ComponentPropsWithoutRef<typeof ThemeTextArea> & { className?: string }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return <ThemeTextArea ref={ref} data-slot="textarea" radius="large" variant="surface" size="3" className={cn("w-full focus:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-shadow", className)} {...props} />
})

export { Textarea }
