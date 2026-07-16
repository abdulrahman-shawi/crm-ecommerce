export default function TestPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">صفحة تيست</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          هذه صفحة تجريبية تمت إضافتها إلى لوحة التحكم.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          إذا كنت ترى هذه الصفحة من داخل القائمة الجانبية، فالمسار يعمل بشكل صحيح.
        </p>
      </div>
    </div>
  );
}