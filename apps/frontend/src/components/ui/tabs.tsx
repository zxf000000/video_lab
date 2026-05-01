"use client"

import * as React from "react"
import { Tabs as ThemeTabs } from "@radix-ui/themes"

import { cn } from "@/src/lib/utils"

type TabsListVariant = "default" | "line"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeTabs.Root>) {
  return <ThemeTabs.Root data-slot="tabs" orientation={orientation} className={cn(className)} {...props} />
}

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeTabs.List> & { variant?: TabsListVariant }) {
  return (
    <ThemeTabs.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(variant === "line" ? "[&_[role=tablist]]:bg-transparent" : "", className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  value,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeTabs.Trigger> & { value: string }) {
  return <ThemeTabs.Trigger data-slot="tabs-trigger" value={value} className={cn(className)} {...props} />
}

function TabsContent({
  className,
  value,
  ...props
}: React.ComponentPropsWithoutRef<typeof ThemeTabs.Content> & { value: string }) {
  return <ThemeTabs.Content data-slot="tabs-content" value={value} className={cn(className)} {...props} />
}

const tabsListVariants = (variant: TabsListVariant = "default") => variant

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
