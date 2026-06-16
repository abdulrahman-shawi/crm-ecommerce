"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface FormCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  label: string;
  description?: string;
  error?: string;
  // لدعم المصفوفات في React Hook Form، نمرر القيمة هنا
  value?: string | number; 
}

export const FormCheckbox = React.forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, description, error, className, id, ...props }, ref) => {
    // توليد ID عشوائي إذا لم يتوفر لربط الليبل بالـ input
    const generatedId = React.useId();
    const checkboxId = id || generatedId;

    return (
      <div className="w-full">
        <div className="flex items-start gap-3 flex-row-reverse text-right">
          <div className="flex h-5 items-center">
            <input
              id={checkboxId}
              type="checkbox"
              ref={ref}
              className={cn(
                "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500",
                "dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950",
                error && "border-red-500",
                className
              )}
              {...props}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium leading-none text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              {label}
            </label>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        </div>
        {error && <span className="text-xs text-red-500 font-medium mt-1 block">{error}</span>}
      </div>
    );
  }
);

FormCheckbox.displayName = "FormCheckbox";