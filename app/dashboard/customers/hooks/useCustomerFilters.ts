import * as React from "react";

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

      const matchesStatus = dateFilter !== "الكل" ? customer.status === dateFilter : true;
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
