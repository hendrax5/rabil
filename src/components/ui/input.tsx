import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-gray-400 dark:placeholder:text-gray-500 selection:bg-blue-500/20 selection:text-blue-900 dark:selection:text-blue-100",
        "h-10 sm:h-11 w-full min-w-0 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 sm:px-4 py-2 text-base sm:text-sm",
        "shadow-sm transition-all duration-200 outline-none",
        "hover:border-gray-300 dark:hover:border-gray-600",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20",
        "file:inline-flex file:h-8 file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:rounded-lg file:px-3 file:text-sm file:font-medium file:mr-3",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800/50",
        "aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
