import type { Permission, PermissionKey } from "./type";

export function resolvePermissionKey(permission: PermissionKey): PermissionKey {
  return permission;
}

export function decoratePermission<T extends Partial<Permission> | null | undefined>(permission: T): T {
  if (!permission) {
    return permission;
  }

  return {
    ...permission,
    viewWholesaleCustomers: Boolean(permission.viewWholesaleCustomers),
    addWholesaleCustomers: Boolean(permission.addWholesaleCustomers),
    editWholesaleCustomers: Boolean(permission.editWholesaleCustomers),
    deleteWholesaleCustomers: Boolean(permission.deleteWholesaleCustomers),
    viewWholesaleOrders: Boolean(permission.viewWholesaleOrders),
    addWholesaleOrders: Boolean(permission.addWholesaleOrders),
    editWholesaleOrders: Boolean(permission.editWholesaleOrders),
    deleteWholesaleOrders: Boolean(permission.deleteWholesaleOrders),
  } as T;
}

export function withWholesalePermissionAliases<T extends { permission?: Permission | null }>(entity: T): T {
  if (!entity.permission) {
    return entity;
  }

  return {
    ...entity,
    permission: decoratePermission(entity.permission),
  };
}

export function getWholesalePermissionMirror(input: Record<string, unknown>) {
  const viewWholesaleCustomers = Boolean(input.viewWholesaleCustomers);
  const addWholesaleCustomers = Boolean(input.addWholesaleCustomers);
  const editWholesaleCustomers = Boolean(input.editWholesaleCustomers);
  const deleteWholesaleCustomers = Boolean(input.deleteWholesaleCustomers);
  const viewWholesaleOrders = Boolean(input.viewWholesaleOrders);
  const addWholesaleOrders = Boolean(input.addWholesaleOrders);
  const editWholesaleOrders = Boolean(input.editWholesaleOrders);
  const deleteWholesaleOrders = Boolean(input.deleteWholesaleOrders);

  return {
    viewWholesaleCustomers,
    addWholesaleCustomers,
    editWholesaleCustomers,
    deleteWholesaleCustomers,
    viewWholesaleOrders,
    addWholesaleOrders,
    editWholesaleOrders,
    deleteWholesaleOrders,
  };
}