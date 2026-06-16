export interface Permission {
  id: string;
  roleName: string;

  viewProducts: boolean;
  addProducts: boolean;
  editProducts: boolean;
  deleteProducts: boolean;

  viewReports: boolean;
  addReports: boolean;
  editReports: boolean;
  deleteReports: boolean;

  viewOrders: boolean;
  addOrders: boolean;
  editOrders: boolean;
  deleteOrders: boolean;

  viewCustomers: boolean;
  addCustomers: boolean;
  editCustomers: boolean;
  deleteCustomers: boolean;

  viewEmployees: boolean;
  addEmployees: boolean;
  editEmployees: boolean;
  deleteEmployees: boolean;

  viewExpenses: boolean;
  addExpenses: boolean;
  editExpenses: boolean;
  deleteExpenses: boolean;

  viewAnalytics: boolean;

  viewCategories: boolean;
  addCategories: boolean;
  editCategories: boolean;
  deleteCategories: boolean;

  viewPermissions: boolean;
  addPermissions: boolean;
  editPermissions: boolean;
  deletePermissions: boolean;

  viewPages: boolean;
  addPages: boolean;
  editPages: boolean;
  deletePages: boolean;

  accessTurkey: boolean;
  accessSyria: boolean;

  users?: User[]; // optional to avoid circular reference issues
}

export type PermissionKey = Exclude<keyof Permission, "id" | "roleName" | "users">;

export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  avatar?: string | null;
  accountType: "ADMIN" | "MANAGER" | "STAFF";
  password: string;
  createdAt: Date;
  updatedAt: Date;

  permissionId?: string | null;
  permission?: Permission | null;
}

export interface NavLink {
  title: string;
  href: string;
  description?: string;
}

export interface NavSection {
  title: string;
  icon?: React.ElementType;
  href?: string;
  links: NavLink[]; // الروابط التابعة لهذا القسم
}

export interface NavItem {
  title: string;
  href?: string;
  isMega?: boolean;
  sections?: NavSection[]; // الأقسام التي تظهر في المنيو الكبير
}