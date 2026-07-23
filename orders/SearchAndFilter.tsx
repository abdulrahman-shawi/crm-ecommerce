import React from 'react';
import { Search, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cityId?: string;
  onCityChange?: (cityId: string) => void;
  cityOptions?: Array<{ value: string; label: string }>;
  warehouseId?: string;
  onWarehouseChange?: (warehouseId: string) => void;
  warehouseOptions?: Array<{ value: string; label: string }>;
  warehouseLocation?: string;
  onWarehouseChangeLegacy?: (location: string) => void;
  shippingCompany: string;
  onShippingCompanyChange: (shippingCompany: string) => void;
  shippingCompanyOptions?: string[];
  monthFilterType: string;
  onMonthFilterChange: (type: string) => void;
  customMonth: string;
  onCustomMonthChange: (month: string) => void;
  onExport?: () => void;
  onImport?: () => void;
  isExporting?: boolean;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchQuery,
  onSearchChange,
  cityId = '',
  onCityChange,
  cityOptions = [],
  warehouseId = '',
  onWarehouseChange,
  warehouseOptions = [],
  shippingCompany,
  onShippingCompanyChange,
  shippingCompanyOptions = [],
  monthFilterType,
  onMonthFilterChange,
  customMonth,
  onCustomMonthChange,
  onExport,
  onImport,
  isExporting = false,
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
      <div className="relative w-full md:w-96">
        <span className="absolute inset-y-0 right-3 flex items-center pr-2 pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </span>
        <input
          type="text"
          placeholder="بحث باسم العميل، الموظف، أو المدينة..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pr-10 pl-3 py-2 border border-gray-300 dark:border-gray-950 rounded-lg bg-white dark:bg-slate-950 dark:text-slate-100 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {onCityChange && (
        <select
          value={cityId}
          onChange={(e) => onCityChange(e.target.value)}
          className="w-full md:w-48 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">كل المدن</option>
          {cityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {onWarehouseChange && (
        <select
          value={warehouseId}
          onChange={(e) => onWarehouseChange(e.target.value)}
          className="w-full md:w-48 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">كل المستودعات</option>
          {warehouseOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {shippingCompanyOptions.length > 0 && (
        <select
          value={shippingCompany}
          onChange={(e) => onShippingCompanyChange(e.target.value)}
          className="w-full md:w-52 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="">كل شركات الشحن</option>
          {shippingCompanyOptions.map((companyName) => (
            <option key={companyName} value={companyName}>
              {companyName}
            </option>
          ))}
        </select>
      )}

      <div className="w-full md:w-auto flex items-center gap-2">
        <select
          value={monthFilterType}
          onChange={(e) => onMonthFilterChange(e.target.value)}
          className="w-full md:w-44 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">إظهار الكل</option>
          <option value="previous">الشهر الماضي</option>
          <option value="current">هذا الشهر</option>
          <option value="custom">مخصص</option>
        </select>

        {monthFilterType === "custom" && (
          <input
            type="month"
            value={customMonth}
            onChange={(e) => onCustomMonthChange(e.target.value)}
            className="w-full md:w-44 p-2 border border-gray-300 dark:border-gray-950 rounded-lg text-sm bg-white dark:bg-slate-950 dark:text-slate-100"
          />
        )}
      </div>

      {(onExport || onImport) && (
        <div className="flex gap-2 w-full md:w-auto justify-end">
          {onImport && (
            <Button
              type="button"
              variant="outline"
              onClick={onImport}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              استيراد
            </Button>
          )}
          {onExport && (
            <Button
              type="button"
              variant="outline"
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              تصدير
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
