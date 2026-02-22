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

export function formatPhoneForDisplay(phone: string) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;

  if (hasPlus && digits.length > 3) {
    const countryCode = digits.slice(0, 3);
    const rest = digits.slice(3);
    const restGroups = rest.match(/.{1,3}/g)?.join(" ") ?? rest;
    return `+${countryCode} ${restGroups}`.trim();
  }

  return digits.match(/.{1,3}/g)?.join(" ") ?? digits;
}