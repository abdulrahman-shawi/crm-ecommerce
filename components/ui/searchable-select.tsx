"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, X } from "lucide-react";

export interface SearchableOption {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  label: string;
  options: SearchableOption[];
  value?: string | number | null;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  error?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "اختر عنصراً...",
  searchPlaceholder = "ابحث هنا...",
  error,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedLabel = React.useMemo(() => {
    const found = options.find((opt) => String(opt.value) === String(value));
    return found ? found.label : "";
  }, [options, value]);

  const filteredOptions = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, search]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="flex flex-col gap-1.5 w-full text-right" ref={containerRef}>
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm transition-all outline-none text-right",
            "focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200",
            error && "border-red-500 focus-within:ring-red-500/20 focus-within:border-red-500",
            isOpen && "ring-2 ring-blue-500/20 border-blue-500"
          )}
        >
          <span className={cn("truncate", !selectedLabel && "text-slate-400")}>
            {selectedLabel || placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && (
              <span
                onClick={handleClear}
                className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              >
                <X size={14} className="text-slate-400" />
              </span>
            )}
            <ChevronDown
              size={16}
              className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")}
            />
          </div>
        </button>

        {isOpen && (
          <div
            className={cn(
              "absolute z-50 w-full mt-1 rounded-md border bg-white dark:bg-slate-950 shadow-lg overflow-hidden",
              "dark:border-slate-800"
            )}
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent outline-none text-sm text-right text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                autoFocus
              />
            </div>

            <div className="max-h-[220px] overflow-y-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "w-full px-3 py-2 text-right text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20",
                      String(value) === String(option.value) &&
                        "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    )}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-center text-sm text-slate-400">
                  لا توجد نتائج
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
    </div>
  );
}
