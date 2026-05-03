"use client"

import * as React from "react"
import { AlertDialog as ThemeAlertDialog, Theme } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

function AlertDialog(props: React.ComponentPropsWithoutRef<typeof ThemeAlertDialog.Root>) {
  return <ThemeAlertDialog.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger(props: React.ComponentPropsWithoutRef<typeof ThemeAlertDialog.Trigger>) {
  return <ThemeAlertDialog.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal() {
  return null
}

function AlertDialogOverlay() {
  return null
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeAlertDialog.Content> & { size?: string }) {
  return (
    <Theme appearance="dark" accentColor="cyan" grayColor="slate" radius="large">
      <ThemeAlertDialog.Content
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn("max-w-[min(92vw,32rem)] rounded-lg border border-line shadow-glow-strong", className)}
        {...props}
      />
    </Theme>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="alert-dialog-footer" className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
}

function AlertDialogMedia({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="alert-dialog-media" className={cn("mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-muted text-mint", className)} {...props} />
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeAlertDialog.Title>) {
  return <ThemeAlertDialog.Title data-slot="alert-dialog-title" className={cn("text-base font-medium", className)} {...props} />
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeAlertDialog.Description>) {
  return <ThemeAlertDialog.Description data-slot="alert-dialog-description" className={cn("text-sm text-gray-500", className)} {...props} />
}

function AlertDialogAction(props: React.ComponentPropsWithoutRef<typeof ThemeAlertDialog.Action>) {
  return <ThemeAlertDialog.Action data-slot="alert-dialog-action" {...props} />
}

function AlertDialogCancel(props: React.ComponentPropsWithoutRef<typeof ThemeAlertDialog.Cancel>) {
  return <ThemeAlertDialog.Cancel data-slot="alert-dialog-cancel" {...props} />
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
