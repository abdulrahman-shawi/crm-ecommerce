import { useAuth } from "@/context/AuthContext";
import { formatPhoneForDisplay, hasPermission } from "@/lib/utils";
import { getCities } from "@/server/city";
import { getCountries } from "@/server/country";
import { createmessage, updateCustomer } from "@/server/customer";
import { MapPin, Phone, Send } from "lucide-react";
import React from "react";
import toast from "react-hot-toast";
import ViewOrderCustomer from "./viewOrder";

export default function GetCustomerSingle({ data, getdatas }: { data: any, getdatas: any }) {
  const [msg, setMsg] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"details" | "orders" | "messages">("details");
  const [countryRows, setCountryRows] = React.useState<any[]>([]);
  const [cityRows, setCityRows] = React.useState<any[]>([]);
  const [localFields, setLocalFields] = React.useState({
    age: "",
    gender: "",
    rating: "",
    source: "",
    country: "",
    city: "",
  });
  const scrollRef = React.useRef<any>(null);
  const { user } = useAuth()
  const canEdit = hasPermission(user, "editCustomers");

  const sourceOptions = [
    { label: "whatsApp", value: "whatsApp" },
    { label: "Facebook", value: "Facebook" },
    { label: "instgram", value: "instgram" },
    { label: "احالة", value: "احالة" },
    { label: "زيارة شخصية", value: "زيارة شخصية" },
    { label: "معرض", value: "معرض" },
    { label: "أرشيف / رقم قديم", value: "أرشيف / رقم قديم" },
  ];

  const genderOptions = [
    { label: "ذكر", value: "ذكر" },
    { label: "أنثى", value: "أنثى" },
  ];

  const ageOptions = [
    { label: "18-25", value: "18-25" },
    { label: "26-35", value: "26-35" },
    { label: "36-45", value: "36-45" },
    { label: "46+", value: "46+" },
  ];

  const ratingOptions = [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
  ];
  const selectedCountryRow = countryRows.find((row) => row.name === localFields.country);
  const filteredCities = selectedCountryRow
    ? cityRows.filter((row) => Number(row.countryId) === Number(selectedCountryRow.id))
    : [];

  React.useEffect(() => {
    let isMounted = true;

    const loadReferenceData = async () => {
      try {
        const [countriesData, citiesData] = await Promise.all([getCountries(), getCities()]);
        if (!isMounted) return;

        setCountryRows(Array.isArray(countriesData) ? countriesData : []);
        setCityRows(Array.isArray(citiesData) ? citiesData : []);
      } catch (error) {
      }
    };

    loadReferenceData();
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    setLocalFields({
      age: data.age || "",
      gender: data.gender || "",
      rating: data.rating ? String(data.rating) : "",
      source: data.source || "",
      country: data.country || "",
      city: data.city || "",
    });
  }, [data]);

  React.useEffect(() => {
    setActiveTab("details");
  }, [data?.id]);

  // التمرير التلقائي عند وصول رسالة جديدة
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: 0, // لأننا نستخدم الترتيب العكسي، فالأعلى هو الأحدث
        behavior: "smooth",
      });
    }
  }, [data.message]);

  const submit = async () => {
    if (!msg.trim()) return;
    const res = await createmessage(msg, data.id, user?.id);
    if (res.success) {
      setMsg("");
      await getdatas();
      toast.success("تم الإرسال");
    }
  };

  const handleFieldChange = async (field: "age" | "gender" | "rating" | "source" | "country" | "city", value: string) => {
    if (!canEdit) {
      toast.error("ليس لديك صلاحية التعديل");
      return;
    }

    setLocalFields((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "country" ? { city: "" } : {}),
    }));

    const payload: any = { [field]: value || undefined };
    if (field === "rating") {
      payload.rating = value ? Number(value) : undefined;
    }
    if (field === "country") {
      payload.city = "";
    }

    const res = await updateCustomer(payload, data.id);
    if (res.success) {
      await getdatas();
      toast.success("تم تحديث البيانات");
    } else {
      toast.error("حدث خطأ أثناء التحديث");
    }
  };

  return (
    <div className="text-slate-800 dark:text-slate-50">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
        <div className="w-full flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {data.name?.charAt(0) || "U"}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{data.name}</h3>
            <div className="border border-slate-500 mt-2 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500">العمر</label>
                <select
                  value={localFields.age}
                  onChange={(e) => handleFieldChange("age", e.target.value)}
                  disabled={!canEdit}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 disabled:opacity-60"
                >
                  <option value="">غير محدد</option>
                  {ageOptions.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500">الجنس</label>
                <select
                  value={localFields.gender}
                  onChange={(e) => handleFieldChange("gender", e.target.value)}
                  disabled={!canEdit}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 disabled:opacity-60"
                >
                  <option value="">غير محدد</option>
                  {genderOptions.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500">التقييم</label>
                <select
                  value={localFields.rating}
                  onChange={(e) => handleFieldChange("rating", e.target.value)}
                  disabled={!canEdit}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 disabled:opacity-60"
                >
                  <option value="">غير محدد</option>
                  {ratingOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500">مصدر العميل</label>
                <select
                  value={localFields.source}
                  onChange={(e) => handleFieldChange("source", e.target.value)}
                  disabled={!canEdit}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 disabled:opacity-60"
                >
                  <option value="">غير محدد</option>
                  {sourceOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-500">تم الانشاء في: {new Date(data.createdAt).toLocaleDateString('ar-EG')}</p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className="inline-flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
          {[
            { id: "details", label: "بيانات العميل" },
            { id: "orders", label: `طلبات العميل (${Array.isArray(data?.orders) ? data.orders.length : 0})` },
            { id: "messages", label: `الرسائل (${Array.isArray(data?.message) ? data.message.length : 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "details" | "orders" | "messages")}
              className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {activeTab === "details" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
              <Phone size={18} className="text-blue-500" />
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">الهاتف</p>
                <p className="text-sm font-bold dark:text-white">
                  <span dir="ltr" className="inline-block text-left">
                    {(Array.isArray(data.phone) ? data.phone : []).map((phone: string) => formatPhoneForDisplay(phone)).join(" - ")}
                  </span>
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
              <MapPin size={18} className="text-red-500" />
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">الدولة</p>
                <select
                  value={localFields.country}
                  onChange={(e) => handleFieldChange("country", e.target.value)}
                  disabled={!canEdit}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 disabled:opacity-60"
                >
                  <option value="">غير محدد</option>
                  {countryRows.map((countryRow) => (
                    <option key={countryRow.id} value={countryRow.name}>{countryRow.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
              <MapPin size={18} className="text-emerald-500" />
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">المدينة</p>
                <select
                  value={localFields.city}
                  onChange={(e) => handleFieldChange("city", e.target.value)}
                  disabled={!canEdit || !localFields.country}
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 disabled:opacity-60"
                >
                  <option value="">غير محدد</option>
                  {filteredCities.map((cityRow) => (
                    <option key={cityRow.id} value={cityRow.name}>{cityRow.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <ViewOrderCustomer orders={Array.isArray(data?.orders) ? data.orders : []} />
          </div>
        )}

        {activeTab === "messages" && (
          <div className="flex flex-col border rounded-[2rem] overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm min-h-[450px]">
            <div className="p-4 border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
              <div className="flex gap-2 items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
                <input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && msg.trim()) submit();
                  }}
                  placeholder="اكتب ملخص تواصل اليوم"
                  className="flex-1 bg-transparent p-2.5 outline-none text-sm dark:text-white"
                />
                <button
                  onClick={submit}
                  disabled={!msg.trim()}
                  className="p-2.5 bg-blue-600 text-white rounded-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            <div className="px-4 py-2 border-b dark:border-slate-800">
              <h4 className="font-bold flex items-center gap-2 dark:text-white text-[11px] uppercase tracking-wider text-slate-400">
                سجل الأنشطة
              </h4>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 h-[350px] overflow-y-auto p-4 flex flex-col-reverse gap-4 bg-transparent no-scrollbar"
            >
              {[...(Array.isArray(data?.message) ? data.message : [])].map((chat: any) => (
                <div key={chat.id} className="flex justify-start animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="w-full p-3 rounded-2xl rounded-tr-none text-sm bg-blue-600 text-white shadow-sm">
                    {chat.message}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[9px] mt-1 opacity-70 text-left">
                          {chat.user.username}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] mt-1 opacity-70 text-left">
                          {new Date(chat.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-[9px] opacity-70 text-left">
                          {new Date(chat.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {(Array.isArray(data?.message) ? data.message.length : 0) === 0 && (
                <p className="text-center text-slate-400 text-xs py-10 italic">
                  لا توجد محادثات سابقة
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}