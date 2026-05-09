"use client"

import * as React from "react"
import { TextArea as ThemeTextArea } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

const MAX_HEIGHT = 320

type TextareaProps = React.ComponentPropsWithoutRef<typeof ThemeTextArea> & { className?: string }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, onChange, ...props },
  ref
) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      autosize(e.currentTarget)
      onChange?.(e)
    },
    [onChange],
  )

  React.useEffect(() => {
    const el = innerRef.current
    if (el) {
      autosize(el)
      const observer = new ResizeObserver(() => autosize(el))
      observer.observe(el)
      return () => observer.disconnect()
    }
  }, [])

  return (
    <ThemeTextArea
      ref={(node) => {
        innerRef.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) ref.current = node
      }}
      data-slot="textarea"
      radius="large"
      variant="surface"
      size="3"
      className={cn(
        "w-full focus:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-shadow resize-none",
        className,
      )}
      style={{ maxHeight: MAX_HEIGHT }}
      onChange={handleChange}
      {...props}
    />
  )
})

export { Textarea }
