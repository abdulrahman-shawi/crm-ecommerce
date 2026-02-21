import * as React from "react";

export function useCustomerSelection(filteredCustomers: any[]) {
  const [selectedCustomers, setSelectedCustomers] = React.useState<any[]>([]);

  const allFilteredIds = React.useMemo(
    () => filteredCustomers.map((customer) => customer.id),
    [filteredCustomers]
  );

  const areAllSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedCustomers.includes(id));

  const toggleSelectAll = () => {
    setSelectedCustomers(areAllSelected ? [] : allFilteredIds);
  };

  const toggleSelect = (id: any) => {
    setSelectedCustomers((prev: any) =>
      prev.includes(id) ? prev.filter((itemId: any) => itemId !== id) : [...prev, id]
    );
  };

  return {
    selectedCustomers,
    setSelectedCustomers,
    allFilteredIds,
    areAllSelected,
    toggleSelectAll,
    toggleSelect,
  };
}
