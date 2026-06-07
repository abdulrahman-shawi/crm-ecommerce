import React from 'react';
import { statusCardColors } from '@/orders/orderHelpers';

interface StatusCardsProps {
  statusOptions: string[];
  statusCounts: Record<string, number>;
  statusFilter: string;
  onStatusChange: (status: string) => void;
}

export const StatusCards: React.FC<StatusCardsProps> = ({
  statusOptions,
  statusCounts,
  statusFilter,
  onStatusChange,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-3 mb-6">
      {statusOptions.map((status) => (
        <button
          key={status}
          onClick={() => onStatusChange(status)}
          className={`p-3 rounded-2xl border text-right transition-all ${
            statusFilter === status
              ? `${statusCardColors[status]} shadow-md`
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-blue-400"
          }`}
        >
          <p className="text-[10px] font-bold uppercase">{status}</p>
          <p className="text-lg font-black">{statusCounts[status] || 0}</p>
        </button>
      ))}
    </div>
  );
};
