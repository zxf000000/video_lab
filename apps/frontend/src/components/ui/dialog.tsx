"use client"

import * as React from "react"
import { Dialog as ThemeDialog, Theme } from "@radix-ui/themes"
import { XIcon } from "lucide-react"

import { cn } from "@/src/lib/utils"

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
    <Theme appearance="dark" accentColor="cyan" grayColor="slate" radius="large">
      <ThemeDialog.Content
        data-slot="dialog-content"
        className={cn(
          "relative flex w-full max-w-[min(92vw,40rem)] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-lg border border-line shadow-glow-strong",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <ThemeDialog.Close>
            <span
              className={cn(
                "absolute top-3 right-3 z-10 inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-panel/5 hover:text-gray-200"
              )}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </span>
          </ThemeDialog.Close>
        ) : null}
      </ThemeDialog.Content>
    </Theme>
  )
}

function DialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2 pr-12", className)} {...props} />
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
          <span className="inline-flex h-9 items-center justify-center rounded-lg border border-line px-4 text-sm text-gray-200 transition-colors hover:border-mint/50 hover:text-mint">
            Close
          </span>
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
  return <ThemeDialog.Description data-slot="dialog-description" className={cn("text-sm text-gray-500", className)} {...props} />
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
