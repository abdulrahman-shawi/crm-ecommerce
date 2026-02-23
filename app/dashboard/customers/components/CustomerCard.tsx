import * as React from "react";
import { hasPermission, isAdmin } from "@/lib/utils";
import { Eye, MessageCircle, Pencil, ShoppingBag, Trash2 } from "lucide-react";

type StatusOption = { label: string; value: string };

const LOCKED_STATUS_VALUES = new Set(["جاري المتابعة", "تم البيع"]);

type CustomerCardProps = {
  customer: any;
  user: any;
  isSelected: boolean;
  statusOptions: StatusOption[];
  onOpenCustomer: (customer: any) => void;
  onToggleSelect: (id: any) => void;
  onEdit: (customer: any) => void;
  onDelete: (customer: any) => void;
  onStatusChange: (customerId: any, status: any) => void;
  onOpenOrder: (customerId: any) => void;
  onViewOrders: (orders: any[]) => void;
  onOpenAssign: (customer: any) => void;
};

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  user,
  isSelected,
  statusOptions,
  onOpenCustomer,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatusChange,
  onOpenOrder,
  onViewOrders,
  onOpenAssign,
}) => {
  return (
    <div
      onClick={() => onOpenCustomer(customer)}
      className={`group border ${customer.orders.length === 1 ? `border-pink-500` : customer.orders.length >= 2 ? "border-purple-500" : "border-transparent"
        } relative bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer`}
    >
      <div className="absolute top-4 right-6 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect(customer.id)}
          className="w-5 h-5 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </div>

      <div className="absolute top-4 left-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {user && hasPermission(user, "editCustomers") && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(customer);
            }}
            className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-400 transition-colors"
          >
            <Pencil size={16} />
          </button>
        )}

        {user && hasPermission(user, "deleteCustomers") && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(customer);
            }}
            className="p-2 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100 dark:bg-slate-800 dark:text-rose-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="flex justify-between items-start mb-6">
        <div className="space-y-3 mt-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">{customer.name}</h3>
            <p className="text-xs text-slate-500 line-clamp-1 italic font-medium">
              {customer.message && customer.message.length > 0
                ? customer.message[customer.message.length - 1].message
                : "لا توجد رسائل..."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center mt-2">
            <select
              value={customer.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                if (LOCKED_STATUS_VALUES.has(e.target.value)) return;
                onStatusChange(customer.id, e.target.value);
              }}
              className={`
appearance-none outline-none cursor-pointer
px-4 py-1.5 rounded-full text-[10px] font-black text-center transition-all border
${customer.status === "فرصة جديدة"
                  ? "bg-blue-100 text-blue-600 border-rose-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                  : customer.status === "جاري المتابعة"
                    ? "bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                    : customer.status === "تم البيع"
                      ? "bg-yellow-100 text-yellow-600 border-green-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800"
                      : customer.status === "غير مهتم / ملغي"
                        ? "bg-red-100 text-red-500 border-slate-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                        : "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                }
`}
            >
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={LOCKED_STATUS_VALUES.has(option.value)}
                  className="bg-white text-slate-900"
                >
                  {option.label}
                </option>
              ))}
            </select>

            {user && isAdmin(user) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAssign(customer);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                title="ربط الموظفين"
              >
                {customer.users?.[0]?.avatar ? (
                  <img
                    src={customer.users[0].avatar}
                    alt={customer.users?.[0]?.username || customer.users?.[0]?.name || "avatar"}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    {customer.users?.[0]?.username || customer.users?.[0]?.name || "غير معين"}
                  </span>
                )}
                {(customer.users?.length || 0) > 1 && (
                  <span className="min-w-6 h-6 px-2 rounded-full bg-blue-100 text-blue-700 text-[11px] font-black flex items-center justify-center">
                    {(customer.users?.length || 0) - 1}
                  </span>
                )}
              </button>
            )}

            <div className="flex flex-col border-r border-slate-200 dark:border-slate-700 pr-3">
              <span className="text-[9px] text-slate-400 font-bold leading-none mb-1">تاريخ التسجيل</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black leading-none">
                {new Date(customer.createdAt).toLocaleDateString("ar-EG", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl font-black text-white border-4 border-white dark:border-slate-800 shadow-lg">
          {customer.name[0].toUpperCase()}
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          {user && hasPermission(user, "addOrders") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenOrder(customer.id);
              }}
              className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
              title="الطلبات"
            >
              <ShoppingBag size={20} />
            </button>
          )}

          {user && hasPermission(user, "viewOrders") && (
            <button
              className="p-2 text-slate-400 hover:text-green-500 hover:bg-blue-50 rounded-xl transition-all"
              title="اظهار الفواتير"
              onClick={(e) => {
                e.stopPropagation();
                onViewOrders(customer.orders);
              }}
            >
              <Eye size={20} />
            </button>
          )}

        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            const rawPhone = customer.phone?.[0] || "";
            const phoneNumber = rawPhone.replace(/\D/g, "");
            const countryCode = (customer.countryCode || "").replace(/\D/g, "");
            if (phoneNumber) {
              window.open(`https://wa.me/${countryCode}${phoneNumber}`, "_blank");
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 shadow-md shadow-green-200 dark:shadow-none"
        >
          <MessageCircle size={16} />
          واتس
        </button>
      </div>
    </div>
  );
};
