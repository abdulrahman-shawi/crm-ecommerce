"use client";

import React from "react";
import { useForm, UseFormReturn, FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";

interface DynamicFormProps<T extends z.ZodType<any>> {
  schema: T;
  onSubmit: (data: z.infer<T>) => void;
  children: (methods: UseFormReturn<any>) => React.ReactNode;
  submitLabel?: string;
  isLoading?: boolean;
  defaultValues?: any; // إضافة هذا السطر
}

export function DynamicForm<T extends z.ZodType<any>>({
  schema,
  onSubmit,
  children,
  submitLabel = "إرسال",
  isLoading = false,
  defaultValues,
}: DynamicFormProps<T>) {
  const methods = useForm<z.infer<T>>({
    resolver: zodResolver(schema as any),
    defaultValues,
  });

  React.useEffect(() => {
    if (defaultValues) {
      methods.reset(defaultValues);
    } else {
      methods.reset();
    }
  }, [defaultValues, methods]);

  return (
    <form onSubmit={methods.handleSubmit(onSubmit as any)} className="space-y-4">
      {children(methods)}

      <div className="pt-4 flex w-full justify-end">
        <Button type="submit" isLoading={isLoading} className="w-full">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
