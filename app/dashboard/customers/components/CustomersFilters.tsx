import * as React from "react";

type CustomersFiltersProps = {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  dateFilter: string;
  setDateFilter: React.Dispatch<React.SetStateAction<string>>;
  genderFilter: string;
  setGenderFilter: React.Dispatch<React.SetStateAction<string>>;
  createdPreset: string;
  setCreatedPreset: React.Dispatch<React.SetStateAction<string>>;
  createdFrom: string;
  setCreatedFrom: React.Dispatch<React.SetStateAction<string>>;
  createdTo: string;
  setCreatedTo: React.Dispatch<React.SetStateAction<string>>;
};

const filterTabs = [
  { id: "فرصة جديدة", label: "فرصة جديدة" },
  { id: "جاري المتابعة", label: "جاري المتابعة" },
  { id: "تم البيع", label: "تم البيع" },
  { id: "غير مهتم / ملغي", label: "غير مهتم / ملغي" },
  { id: "الكل", label: "الكل" },
];

export const CustomersFilters: React.FC<CustomersFiltersProps> = ({
  search,
  setSearch,
  dateFilter,
  setDateFilter,
  genderFilter,
  setGenderFilter,
  createdPreset,
  setCreatedPreset,
  createdFrom,
  setCreatedFrom,
  createdTo,
  setCreatedTo,
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 items-center">
        <div className="col-span-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالرقم أو الاسم أو الدولة أو المدينة أو اسم الموظف"
            className="flex-1 h-11 w-full rounded-lg border border-slate-800/50 dark:border-slate-100/50 text-slate-800 dark:text-slate-100 bg-transparent p-5 my-3"
          />
        </div>

        <div className="flex bg-slate-100 w-full justify-center dark:bg-slate-800 p-1 rounded-xl gap-1 h-11 items-center">
          {filterTabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setDateFilter(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dateFilter === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3"
          >
            <option value="الكل">الجنس: الكل</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <select
          value={createdPreset}
          onChange={(e) => setCreatedPreset(e.target.value)}
          className="h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3"
        >
          <option value="all">الكل</option>
          <option value="today">اليوم</option>
          <option value="last7">آخر 7 أيام</option>
          <option value="month">هذا الشهر</option>
          <option value="custom">مخصص</option>
        </select>

        {createdPreset === "custom" && (
          <>
            <input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3"
            />
            <input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="h-11 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-3"
            />
          </>
        )}
      </div>
    </div>
  );
};
