"use client"

import * as React from "react"
import { Dialog as ThemeDialog } from "@radix-ui/themes"
import { XIcon } from "lucide-react"

import { cn } from "@/src/lib/utils"
import { Button } from "@/src/components/ui/button"

function Dialog(props: React.ComponentPropsWithoutRef<typeof ThemeDialog.Root>) {
  return <ThemeDialog.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentPropsWithoutRef<typeof ThemeDialog.Trigger>) {
  return <ThemeDialog.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: React.ComponentPropsWithoutRef<typeof ThemeDialog.Close>) {
  return <ThemeDialog.Close data-slot="dialog-close" {...props} />
}

function DialogPortal() {
  return null
}

function DialogOverlay() {
  return null
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeDialog.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <ThemeDialog.Content
      data-slot="dialog-content"
      className={cn("max-w-[min(92vw,40rem)] rounded-3xl", className)}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <ThemeDialog.Close>
          <Button variant="ghost" className="absolute top-3 right-3" size="icon">
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </ThemeDialog.Close>
      ) : null}
    </ThemeDialog.Content>
  )
}

function DialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { showCloseButton?: boolean }) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-[inherit] border-t border-line bg-panel2/60 px-6 py-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <ThemeDialog.Close>
          <Button variant="outline">Close</Button>
        </ThemeDialog.Close>
      ) : null}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeDialog.Title>) {
  return <ThemeDialog.Title data-slot="dialog-title" className={cn("text-base font-medium", className)} {...props} />
}

function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeDialog.Description>) {
  return <ThemeDialog.Description data-slot="dialog-description" className={cn("text-sm text-slate-500", className)} {...props} />
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
