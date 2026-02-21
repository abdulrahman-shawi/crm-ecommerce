import * as React from "react";

export function useCustomerFilters(customers: any[], search: string, dateFilter: string) {
  return React.useMemo(() => {
    return customers.filter((customer: any) => {
      const matchesSearch =
        customer.name?.toLowerCase().includes(search.toLowerCase()) ||
        customer.countryCode?.toLowerCase().includes(search.toLowerCase()) ||
        customer.phone?.some((phone: any) => phone.toLowerCase().includes(search.toLowerCase())) ||
        customer.city?.toLowerCase().includes(search.toLowerCase()) ||
        customer.country?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = dateFilter !== "الكل" ? customer.status === dateFilter : true;

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, dateFilter]);
}
