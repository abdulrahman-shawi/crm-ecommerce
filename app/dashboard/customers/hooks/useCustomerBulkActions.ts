import { hasPermission } from "@/lib/utils";
import { AssignUsers, deleteCustomer } from "@/server/customer";
import toast from "react-hot-toast";
import * as React from "react";

type UseCustomerBulkActionsParams = {
  selectedCustomers: any[];
  user: any;
  getData: () => Promise<void>;
  setSelectedCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  setIsBulkAssignOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useCustomerBulkActions({
  selectedCustomers,
  user,
  getData,
  setSelectedCustomers,
  setIsBulkAssignOpen,
}: UseCustomerBulkActionsParams) {
  const handleBulkAssignUsers = async (_: string, userIds: string[]) => {
    if (selectedCustomers.length === 0) {
      toast.error("لا يوجد عملاء محددين");
      return;
    }

    const loading = toast.loading("جار ربط الموظفين بالعملاء المحددين");
    try {
      const results = await Promise.all(
        selectedCustomers.map((customerId) =>
          AssignUsers(customerId, userIds)
            .then(() => ({ success: true }))
            .catch(() => ({ success: false }))
        )
      );

      const failedCount = results.filter((result) => !result.success).length;
      if (failedCount > 0) {
        toast.error(`تعذر ربط ${failedCount} عميل`);
      } else {
        toast.success("تم ربط الموظفين بنجاح");
      }

      await getData();
      setSelectedCustomers([]);
      setIsBulkAssignOpen(false);
    } finally {
      toast.dismiss(loading);
    }
  };

  const handleBulkDelete = async () => {
    if (!user || !hasPermission(user, "deleteCustomers")) {
      toast.error("ليس لديك صلاحية حذف العملاء");
      return;
    }

    if (selectedCustomers.length === 0) {
      toast.error("لا يوجد عملاء محددين");
      return;
    }

    const confirmDelete = window.confirm("هل أنت متأكد من حذف العملاء المحددين؟");
    if (!confirmDelete) {
      return;
    }

    const loading = toast.loading("جار حذف العملاء");
    try {
      const results = await Promise.all(
        selectedCustomers.map((customerId) =>
          deleteCustomer({ id: customerId })
            .then((res) => ({ success: res.success }))
            .catch(() => ({ success: false }))
        )
      );

      const successCount = results.filter((result) => result.success).length;
      const failedCount = results.filter((result) => !result.success).length;

      if (successCount > 0) {
        toast.success(`تم حذف ${successCount} عميل`);
      }
      if (failedCount > 0) {
        toast.error(`تعذر حذف ${failedCount} عميل`);
      }

      await getData();
      setSelectedCustomers([]);
    } finally {
      toast.dismiss(loading);
    }
  };

  return {
    handleBulkAssignUsers,
    handleBulkDelete,
  };
}
