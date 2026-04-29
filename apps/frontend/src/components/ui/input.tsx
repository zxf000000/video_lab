import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/src/lib/utils"

function Input({ className, type, ...props }: React.ComponentPropsWithoutRef<typeof InputPrimitive> & { className?: string; type?: string }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 rounded-xl border border-line bg-panel2 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-mint disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input }
