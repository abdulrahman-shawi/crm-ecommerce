"use client";

import React, { useMemo } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { 
  MoreVertical, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Inbox 
} from "lucide-react";
import { cn } from "@/lib/utils"; // تأكد من وجود هذا المسار في مشروعك

// --- Types ---

export interface TableAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (item: T) => void;
  variant?: "default" | "danger";
}

export interface Column<T> {
  header: React.ReactNode;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  rowKey?: keyof T | ((item: T) => string | number); // أضف هذا السطر
  columns: Column<T>[];
  actindir?:boolean;
  actions?: TableAction<T>[];
  isLoading?: boolean;
  totalCount: number;  
  pageSize: number;    
  currentPage: number; 
  onPageChange: (page: number) => void;
}

/**
 * DataTable: مكون عرض البيانات المتقدم
 * يدعم التقسيم (Pagination) التلقائي من جهة العميل
 */
export function DataTable<T extends { id: string | number }>({
  data,
  rowKey,
  actindir,
  columns,
  actions,
  isLoading,
  totalCount,
  pageSize,
  currentPage,
  onPageChange,
}: DataTableProps<T>) {
  
  // 1. حساب إجمالي الصفحات
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize]);
  const getRowKey = (item: T, index: number) => {
    if (typeof rowKey === 'function') return rowKey(item);
    if (rowKey && item[rowKey]) return item[rowKey] as string | number;
    return item.id || index; // القيمة الافتراضية
  };
  // 2. منطق القص (Slice) لعرض صفحة واحدة فقط من المصفوفة
  const paginatedData = useMemo(() => {
    // إذا كانت البيانات المرسلة هي بالفعل صفحة واحدة من السيرفر، لا داعي للقص
    // لكن بما أنك ترسل مصفوفة كاملة، سنقوم بقصها هنا
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const canNextPage = currentPage < totalPages;
  const canPrevPage = currentPage > 1;

  return (
    <div className="flex flex-col gap-4 w-full" dir="rtl">
      <div className="relative w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-[2px]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={cn("p-4 font-bold text-slate-900 dark:text-slate-100", col.className)}>
                  <div className="flex items-center gap-2">
                    {col.header}
                    {col.sortable && <ArrowUpDown className="w-3.5 h-3.5 cursor-pointer opacity-50 hover:opacity-100 transition-opacity" />}
                  </div>
                </th>
              ))}
              {actions && <th className="p-4 w-20 text-center text-slate-900 dark:text-slate-100 font-bold">الإجراءات</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, idx) => (
                <tr key={getRowKey(item, idx)} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                  {columns.map((col, idx) => (
                    <td key={idx} className={cn("p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap", col.className)}>
                      {typeof col.accessor === "function" 
                        ? col.accessor(item) 
                        : (item[col.accessor] as React.ReactNode)}
                    </td>
                  ))}
                  
                  {actions && (
                    <td className="p-4 w-20 text-center">
                      <ActionMenu actions={actions} item={item} actiondir={actindir} />
                    </td>
                  )}
                </tr>
              ))
            ) : !isLoading && (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Inbox className="w-12 h-12 stroke-[1.5]" />
                    <p className="text-base">لم يتم العثور على أي بيانات حالياً</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Pagination Controls --- */}
      <div className="flex items-center justify-between px-2 py-4 border-t border-slate-100 dark:border-slate-800">
        <div className="text-sm text-slate-500">
          إظهار <span className="font-semibold">{paginatedData.length}</span> من أصل <span className="font-semibold">{totalCount}</span> نتيجة
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            الصفحة {currentPage} من {totalPages || 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!canPrevPage || isLoading}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!canNextPage || isLoading}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// مكون قائمة الإجراءات
function ActionMenu<T>({ actions, item  , actiondir}: { actions: TableAction<T>[], item: T , actiondir?:boolean }) {
  return (
    <div className="">
      {actiondir === true ? (
        <div className="flex items-center gap-2">
          {actions.map((e , i) => (
            <button key={i} className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all" onClick={() =>  e.onClick(item)}>{e.icon}</button>
          ))}
        </div>
      ):(
        <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all">
          <MoreVertical className="w-4 h-4 text-slate-500" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" className="min-w-[140px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-lg z-50">
          {actions.map((action, idx) => (
            <DropdownMenu.Item
              key={idx}
              onClick={() => action.onClick(item)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer rounded-md outline-none",
                action.variant === "danger" ? "text-red-500 focus:bg-red-50" : "text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800"
              )}
            >
              {action.icon}
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
      )}
    </div>
  );
}