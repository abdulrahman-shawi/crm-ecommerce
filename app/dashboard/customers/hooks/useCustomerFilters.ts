import * as React from "react";

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

export function useCustomerFilters(
  customers: any[],
  search: string,
  dateFilter: string,
  createdFrom: string,
  createdTo: string
) {
  return React.useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    const fromKey = createdFrom || "";
    const toKey = createdTo || "";
    const rangeStart = fromKey && toKey ? (fromKey <= toKey ? fromKey : toKey) : fromKey || toKey;
    const rangeEnd = fromKey && toKey ? (fromKey <= toKey ? toKey : fromKey) : fromKey || toKey;

    return customers.filter((customer: any) => {
      const hasAssignedUserMatch = Array.isArray(customer.users)
        ? customer.users.some((assignedUser: any) => {
            const username = String(assignedUser?.username ?? "").toLowerCase();
            const name = String(assignedUser?.name ?? "").toLowerCase();
            const email = String(assignedUser?.email ?? "").toLowerCase();
            return (
              username.includes(normalizedSearch) ||
              name.includes(normalizedSearch) ||
              email.includes(normalizedSearch)
            );
          })
        : false;

      const matchesSearch =
        customer.name?.toLowerCase().includes(normalizedSearch) ||
        customer.countryCode?.toLowerCase().includes(normalizedSearch) ||
        customer.phone?.some((phone: any) => String(phone ?? "").toLowerCase().includes(normalizedSearch)) ||
        customer.city?.toLowerCase().includes(normalizedSearch) ||
        customer.country?.toLowerCase().includes(normalizedSearch) ||
        hasAssignedUserMatch;

      const selectedStatus = normalizeStatus(dateFilter);
      const currentStatus = normalizeStatus(customer?.status);
      const matchesStatus = selectedStatus !== normalizeStatus("الكل")
        ? currentStatus === selectedStatus
        : true;
      const customerCreatedAt = customer?.createdAt ? new Date(customer.createdAt) : null;
      const hasValidCreatedAt = Boolean(customerCreatedAt && !Number.isNaN(customerCreatedAt.getTime()));
      const customerCreatedKey = hasValidCreatedAt
        ? `${customerCreatedAt!.getFullYear()}-${String(customerCreatedAt!.getMonth() + 1).padStart(2, "0")}-${String(customerCreatedAt!.getDate()).padStart(2, "0")}`
        : "";
      const matchesCreatedAt =
        (!rangeStart || customerCreatedKey >= rangeStart) &&
        (!rangeEnd || customerCreatedKey <= rangeEnd);

      return matchesSearch && matchesStatus && matchesCreatedAt;
    });
  }, [customers, search, dateFilter, createdFrom, createdTo]);
}
