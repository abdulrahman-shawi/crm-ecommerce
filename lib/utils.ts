import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PermissionKey, User } from './type';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isAdmin(user?: User | null) {
  return user?.accountType === 'ADMIN';
}

export function hasPermission(user: User | null | undefined, permission: PermissionKey) {
  return isAdmin(user) || Boolean(user?.permission?.[permission]);
}

export function hasAnyPermission(user: User | null | undefined, permissions: PermissionKey[]) {
  return isAdmin(user) || permissions.some((permission) => Boolean(user?.permission?.[permission]));
}