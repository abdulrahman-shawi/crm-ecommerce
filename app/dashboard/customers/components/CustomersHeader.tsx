import * as React from "react";
import { Button } from "@/components/ui/button";
import { hasPermission, isAdmin } from "@/lib/utils";
import { CheckSquare, Download, Plus, Trash2, Upload, UserPlus, XCircle } from "lucide-react";

type CustomersHeaderProps = {
  user: any;
  selectedCount: number;
  importInputRef: React.RefObject<HTMLInputElement>;
  onOpenCreate: () => void;
  onToggleSelectAll: () => void;
  onOpenBulkAssign: () => void;
  onBulkDelete: () => void;
  onImportClick: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onClearSelection: () => void;
};

export const CustomersHeader: React.FC<CustomersHeaderProps> = ({
  user,
  selectedCount,
  importInputRef,
  onOpenCreate,
  onToggleSelectAll,
  onOpenBulkAssign,
  onBulkDelete,
  onImportClick,
  onImportFile,
  onExport,
  onClearSelection,
}) => {
  return (
    <div className="flex justify-between flex-wrap gap-3 items-center mb-8 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">نظام إدارة العملاء</h1>
      <div className="flex items-center flex-wrap gap-3">
        {user && hasPermission(user, "addCustomers") && (
          <Button onClick={onOpenCreate}><Plus size={20} /></Button>
        )}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {user && isAdmin(user) && (
              <Button onClick={onToggleSelectAll} variant="outline">
                <CheckSquare size={20} />
              </Button>
            )}

            {selectedCount > 0 && user && isAdmin(user) && (
              <>
                <Button onClick={onOpenBulkAssign} variant="outline">
                  <UserPlus size={20} />
                </Button>
                {hasPermission(user, "deleteCustomers") && (
                  <Button onClick={onBulkDelete} variant="secondary">
                    <Trash2 size={20} />
                  </Button>
                )}
              </>
            )}

            {user && isAdmin(user) && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onImportFile}
                  className="hidden"
                />
                <Button onClick={onImportClick} variant="outline">
                  <Upload size={20} />
                </Button>
              </>
            )}

            {user && isAdmin(user) && (
              <Button onClick={onExport}><Download size={20} /></Button>
            )}

            {selectedCount > 0 && (
              <button
                onClick={onClearSelection}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                title="إلغاء التحديد"
              >
                <XCircle size={24} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
