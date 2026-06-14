"use client";

import React from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/utils";
import { deleteReview, getReviews } from "@/server/review";

const PAGE_SIZE = 10;

export default function CommentsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getReviews();
      if (res.success) {
        setReviews(res.data || []);
      } else {
        toast.error(res.error || "فشل في جلب التعليقات");
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (item: any) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا التعليق؟")) return;

    const loadingToast = toast.loading("جاري حذف التعليق...");
    try {
      const res = await deleteReview(item.id, user);
      if (res.success) {
        toast.success("تم حذف التعليق بنجاح");
        loadData();
      } else {
        toast.error(res.error || "فشل في حذف التعليق");
      }
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  if (!user || !isAdmin(user)) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة التعليقات</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">إدارة التعليقات</h1>
      </div>

      <DataTable
        data={reviews}
        totalCount={reviews.length}
        pageSize={PAGE_SIZE}
        currentPage={page}
        onPageChange={setPage}
        isLoading={loading}
        actindir={true}
        actions={[
          {
            label: "حذف",
            icon: <Trash2 size={18} />,
            variant: "danger",
            onClick: handleDelete,
          },
        ]}
        columns={[
          {
            header: "المنتج",
            accessor: (row: any) => row.product?.name || "-",
          },
          {
            header: "اسم المعلق",
            accessor: (row: any) => row.name || "-",
          },
          {
            header: "المستخدم",
            accessor: (row: any) => row.user?.username || row.user?.email || "-",
          },
          {
            header: "التقييم",
            accessor: (row: any) => row.rating || "-",
          },
          {
            header: "التعليق",
            accessor: (row: any) => row.comment || "-",
          },
          {
            header: "التاريخ",
            accessor: (row: any) =>
              row.createdAt
                ? new Date(row.createdAt).toLocaleDateString("ar-EG", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "-",
          },
        ]}
      />
    </div>
  );
}
