"use client"

import * as React from "react"
import { Dialog as ThemeDialog, Theme } from "@radix-ui/themes"
import { XIcon } from "lucide-react"

import { cn } from "@/src/lib/utils"
import { Button } from "@/src/components/ui/button"

function Sheet(props: React.ComponentPropsWithoutRef<typeof ThemeDialog.Root>) {
  return <ThemeDialog.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: React.ComponentPropsWithoutRef<typeof ThemeDialog.Trigger>) {
  return <ThemeDialog.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentPropsWithoutRef<typeof ThemeDialog.Close>) {
  return <ThemeDialog.Close data-slot="sheet-close" {...props} />
}

function SheetPortal() {
  return null
}

function SheetOverlay() {
  return null
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeDialog.Content> & {
  side?: "left" | "right" | "top" | "bottom"
  showCloseButton?: boolean
}) {
  return (
    <Theme appearance="light" accentColor="iris" grayColor="slate" radius="large">
      <ThemeDialog.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-[60] flex max-h-[100vh] flex-col gap-4 rounded-none border-0 p-0 shadow-2xl",
          "data-[side=right]:top-0 data-[side=right]:right-0 data-[side=right]:h-screen data-[side=right]:w-[min(32rem,92vw)]",
          "data-[side=left]:top-0 data-[side=left]:left-0 data-[side=left]:h-screen data-[side=left]:w-[min(32rem,92vw)]",
          "data-[side=top]:top-0 data-[side=top]:left-0 data-[side=top]:w-screen",
          "data-[side=bottom]:bottom-0 data-[side=bottom]:left-0 data-[side=bottom]:w-screen",
          className
        )}
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
    </Theme>
  )
}

function SheetHeader({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-0.5 p-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
}

function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeDialog.Title>) {
  return <ThemeDialog.Title data-slot="sheet-title" className={cn("text-base font-medium text-foreground", className)} {...props} />
}

function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeDialog.Description>) {
  return <ThemeDialog.Description data-slot="sheet-description" className={cn("text-sm text-slate-500", className)} {...props} />
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
}
