"use client";

import * as React from "react";
import PhoneInput from "react-phone-number-input";
import toast from "react-hot-toast";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  FilePlus2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  ClipboardList,
} from "lucide-react";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { DataTable, type Column, type TableAction } from "@/components/shared/DataTable";
import { useAuth } from "@/context/AuthContext";
import { formatPhoneForDisplay, hasAnyPermission, hasPermission, isAdmin } from "@/lib/utils";
import WholesaleOrderCustomer from "@/orders/WholesaleOrderCustomer";

import {
  createWholesaleCustomer,
  createWholesaleVisit,
  deleteWholesaleCustomer,
  getWholesaleCustomers,
  getWholesaleSalesReps,
  updateWholesaleCustomer,
} from "@/server/wholesale-customer";

type SalesRep = {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  accountType: string;
};

type WholesaleVisit = {
  id: string;
  visitedAt: string | Date;
  result: string;
  status: string;
  followUpType?: string | null;
  rejectionReasonCode?: string | null;
  rejectionReasonOther?: string | null;
  notes: string | null;
  voiceNote: string | null;
  photoUrls: string[];
  latitude: number | null;
  longitude: number | null;
  nextFollowUpAt: string | Date | null;
  followUpNotes: string | null;
  orderPlaced: boolean;
  syncedAt: string | Date | null;
  createdAt: string | Date;
  user: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
};

type WholesaleCustomer = {
  id: string;
  name: string;
  category: string;
  categoryOther?: string | null;
  contactName: string | null;
  contactRole?: string | null;
  contactRoleOther?: string | null;
  phone: string[];
  whatsappPhone: string | null;
  country: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  notes: string | null;
  preferredVisitAt: string | Date | null;
  lastVisitAt: string | Date | null;
  nextFollowUpAt: string | Date | null;
  lastVisitResult: string | null;
  visitStatus: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  assignedUserId: string | null;
  assignedUser: SalesRep | null;
  visits: WholesaleVisit[];
  _count: {
    visits: number;
  };
};

type CustomerFormState = {
  name: string;
  category: string;
  categoryOther: string;
  contactName: string;
  contactRole: string;
  contactRoleOther: string;
  phoneNumbers: string[];
  country: string;
  city: string;
  area: string;
  address: string;
  latitude: string;
  longitude: string;
  googleMapsLink: string;
  assignedUserId: string;
  notes: string;
  preferredVisitAt: string;
  nextFollowUpAt: string;
  visitStatus: string;
  isActive: boolean;
};

type VisitFormState = {
  userId: string;
  visitedAt: string;
  result: string;
  notes: string;
  nextFollowUpAt: string;
  followUpType: string;
  followUpNotes: string;
  rejectionReasonCode: string;
  rejectionReasonOther: string;
};

const ACTIVITY_OPTIONS = [
  { value: "PHARMACY", label: "🏥 صيدلية" },
  { value: "SALON", label: "💇 كوافير / صالون تجميل" },
  { value: "BEAUTY_STORE", label: "💄 محل تجميل" },
  { value: "ELECTRONICS_STORE", label: "⚡ محل أجهزة كهربائية" },
  { value: "DISTRIBUTOR", label: "📦 موزع / تاجر جملة" },
  { value: "ONLINE_STORE", label: "🌐 متجر إلكتروني" },
  { value: "COMPANY", label: "🏢 شركة" },
  { value: "OTHER", label: "❓ أخرى" },
];

const LEGACY_ACTIVITY_LABELS: Record<string, string> = {
  MARKET: "سوبر ماركت",
  CLINIC: "عيادة",
};

const WHOLESALE_COUNTRY_OPTIONS = ["سوريا", "تركيا"] as const;

const WHOLESALE_CITIES_BY_COUNTRY: Record<(typeof WHOLESALE_COUNTRY_OPTIONS)[number], string[]> = {
  "سوريا": [
    "دمشق",
    "ريف دمشق",
    "حلب",
    "حمص",
    "حماة",
    "اللاذقية",
    "طرطوس",
    "إدلب",
    "درعا",
    "السويداء",
    "القنيطرة",
    "دير الزور",
    "الرقة",
    "الحسكة",
  ],
  "تركيا": [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin",
    "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa",
    "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan",
    "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay",
    "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli",
    "Kırşehir", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin",
    "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt",
    "Sinop", "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak",
    "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman",
    "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce",
  ],
};

const VISIT_RESULT_OPTIONS = [
  { value: "VERY_INTERESTED", label: "🔥 فرصة ساخنة" },
  { value: "INTERESTED", label: "✨ فرصة" },
  { value: "THINKING", label: "🔄 متابعة" },
  { value: "NOT_INTERESTED", label: "🔴 مرفوض" },
  { value: "PURCHASED", label: "💰 تم البيع" },
];

const REJECTION_REASON_OPTIONS = [
  { value: "PRICE_HIGH", label: "💰 السعر مرتفع." },
  { value: "NO_DEMAND", label: "📦 لا يوجد طلب على المنتج." },
  { value: "COMPETITOR_BRAND", label: "🏷️ يبيع ماركة منافسة." },
  { value: "NO_BEAUTY_DEVICES", label: "🚫 لا يبيع أجهزة تجميل." },
  { value: "NOT_DECISION_MAKER", label: "👤 ليس صاحب القرار." },
  { value: "REVIEW_LATER", label: "⏳ طلب المراجعة لاحقًا." },
  { value: "NOT_CONVINCED", label: "❌ غير مقتنع بالمنتج." },
  { value: "FIXED_SUPPLIER", label: "🤝 لديه مورد ثابت." },
  { value: "OTHER", label: "✍️ سبب آخر" },
];

const VISIT_STATUS_OPTIONS = [
  { value: "PLANNED", label: "مخطط لها" },
  { value: "VISITED", label: "تمت الزيارة" },
  { value: "FOLLOW_UP_REQUIRED", label: "تحتاج متابعة" },
  { value: "CLOSED", label: "مغلقة" },
];

const FOLLOW_UP_TYPE_OPTIONS = [
  { value: "VISIT", label: "زيارة" },
  { value: "CALL", label: "اتصال" },
];

const CONTACT_ROLE_OPTIONS = [
  { value: "OWNER", label: "مالك" },
  { value: "MANAGER", label: "مدير" },
  { value: "SALES_EMPLOYEE", label: "موظف مبيعات" },
  { value: "EMPLOYEE", label: "موظف" },
  { value: "OTHER", label: "أخرى" },
];

const COUNTRY_MAP_CONFIG = {
  "سوريا": {
    center: { latitude: 34.8, longitude: 38.8 },
    delta: { latitude: 2.2, longitude: 2.8 },
  },
  "تركيا": {
    center: { latitude: 39.0, longitude: 35.0 },
    delta: { latitude: 5.5, longitude: 8.5 },
  },
} as const;

type WholesaleCountry = (typeof WHOLESALE_COUNTRY_OPTIONS)[number];

type GeoCoordinates = {
  latitude: number;
  longitude: number;
};

type LocationState = {
  status: "idle" | "loading" | "ready" | "denied" | "unsupported" | "error";
  coordinates: GeoCoordinates | null;
  country: WholesaleCountry;
};

function createEmptyCustomerForm(): CustomerFormState {
  return {
    name: "",
    category: "PHARMACY",
    categoryOther: "",
    contactName: "",
    contactRole: "OWNER",
    contactRoleOther: "",
    phoneNumbers: [""],
    country: "سوريا",
    city: "",
    area: "",
    address: "",
    latitude: "",
    longitude: "",
    googleMapsLink: "",
    assignedUserId: "",
    notes: "",
    preferredVisitAt: "",
    nextFollowUpAt: "",
    visitStatus: "PLANNED",
    isActive: true,
  };
}

function createEmptyVisitForm(): VisitFormState {
  return {
    userId: "",
    visitedAt: toDateTimeLocalValue(new Date()),
    result: "INTERESTED",
    notes: "",
    nextFollowUpAt: "",
    followUpType: "VISIT",
    followUpNotes: "",
    rejectionReasonCode: "",
    rejectionReasonOther: "",
  };
}

function toDateTimeLocalValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateLabel(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseTextList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePhoneListInput(values: string[]) {
  return values.map((item) => item.trim()).filter(Boolean);
}

function getUniqueDisplayPhones(values: string[] | null | undefined) {
  const normalizedValues = Array.isArray(values)
    ? values.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const uniqueValues = normalizedValues.filter((item, index) => normalizedValues.indexOf(item) === index);

  return uniqueValues.map((item) => formatPhoneForDisplay(item));
}

function isWholesaleCountry(value: string): value is (typeof WHOLESALE_COUNTRY_OPTIONS)[number] {
  return WHOLESALE_COUNTRY_OPTIONS.includes(value as (typeof WHOLESALE_COUNTRY_OPTIONS)[number]);
}

function getPhoneDefaultCountry(country: string) {
  return country === "تركيا" ? "TR" : "SY";
}

function getAllowedCountriesFromAccess(): WholesaleCountry[] {
  return [...WHOLESALE_COUNTRY_OPTIONS];
}

function getAllowedCountriesFromUser(_value: unknown) {
  return getAllowedCountriesFromAccess();
}

function parseMapLinkCoordinates(value: string): GeoCoordinates | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const patterns = [
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  try {
    const url = new URL(normalized);
    const q = url.searchParams.get("q") || url.searchParams.get("ll");
    if (!q) return null;

    const [latitudeText, longitudeText] = q.split(",");
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  } catch {
    return null;
  }

  return null;
}

function isWithinBounds(
  latitude: number,
  longitude: number,
  bounds: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number }
) {
  return latitude >= bounds.minLatitude
    && latitude <= bounds.maxLatitude
    && longitude >= bounds.minLongitude
    && longitude <= bounds.maxLongitude;
}

function getCountryFromCoordinates(latitude: number, longitude: number): WholesaleCountry {
  if (isWithinBounds(latitude, longitude, {
    minLatitude: 35.8,
    maxLatitude: 42.2,
    minLongitude: 25.5,
    maxLongitude: 45.0,
  })) {
    return "تركيا";
  }

  if (isWithinBounds(latitude, longitude, {
    minLatitude: 32.0,
    maxLatitude: 37.5,
    minLongitude: 35.5,
    maxLongitude: 42.5,
  })) {
    return "سوريا";
  }

  return "سوريا";
}

function createGoogleMapsLink(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

function createMapEmbedUrl(center: GeoCoordinates, country: WholesaleCountry, focusOnLocation: boolean) {
  const baseDelta = focusOnLocation
    ? { latitude: 0.08, longitude: 0.12 }
    : COUNTRY_MAP_CONFIG[country].delta;

  const minLongitude = center.longitude - baseDelta.longitude;
  const maxLongitude = center.longitude + baseDelta.longitude;
  const minLatitude = center.latitude - baseDelta.latitude;
  const maxLatitude = center.latitude + baseDelta.latitude;
  const params = new URLSearchParams({
    bbox: `${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`,
    layer: "mapnik",
    marker: `${center.latitude},${center.longitude}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

function getLocationStatusMessage(status: LocationState["status"]) {
  switch (status) {
    case "loading":
      return "جارٍ تحديد موقع المسؤول الحالي...";
    case "ready":
      return "تم تحديد موقع المسؤول الحالي وعرضه على الخريطة.";
    case "denied":
      return "تم رفض صلاحية الموقع. تم فتح الخريطة على سوريا بشكل افتراضي.";
    case "unsupported":
      return "المتصفح لا يدعم تحديد الموقع. تم فتح الخريطة على سوريا بشكل افتراضي.";
    case "error":
      return "تعذر تحديد الموقع الحالي. تم فتح الخريطة على سوريا بشكل افتراضي.";
    default:
      return "سيتم فتح الخريطة على موقع المسؤول إن توفر، وإلا على سوريا افتراضياً.";
  }
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFollowUpResult(value: string) {
  return value === "VERY_INTERESTED" || value === "INTERESTED" || value === "THINKING";
}

function requiresFollowUpType(value: string) {
  return value === "VERY_INTERESTED" || value === "INTERESTED" || value === "THINKING";
}

function isRejectedResult(value: string) {
  return value === "NOT_INTERESTED";
}

function getCategoryLabel(value: string, other?: string | null) {
  if (value === "OTHER" && other) return other;
  return ACTIVITY_OPTIONS.find((item) => item.value === value)?.label ?? LEGACY_ACTIVITY_LABELS[value] ?? other ?? value;
}

function getVisitResultLabel(value: string | null | undefined) {
  if (!value) return "-";
  return VISIT_RESULT_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getVisitStatusLabel(value: string) {
  return VISIT_STATUS_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getFollowUpTypeLabel(value?: string | null) {
  if (!value) return "-";
  return FOLLOW_UP_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getContactRoleLabel(value?: string | null, other?: string | null) {
  if (!value) return "-";
  if (value === "OTHER") return other || "أخرى";
  return CONTACT_ROLE_OPTIONS.find((item) => item.value === value)?.label ?? other ?? value;
}

function getRejectionReasonLabel(code?: string | null, other?: string | null) {
  if (!code) return "-";
  if (code === "OTHER") return other || "سبب آخر";
  return REJECTION_REASON_OPTIONS.find((item) => item.value === code)?.label ?? other ?? code;
}

export default function WholesaleCustomersPage() {
  const PAGE_SIZE = 12;
  const { user, loading } = useAuth();
  const [customers, setCustomers] = React.useState<WholesaleCustomer[]>([]);
  const [salesReps, setSalesReps] = React.useState<SalesRep[]>([]);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = React.useState("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState("ALL");
  const [selectedRepId, setSelectedRepId] = React.useState("ALL");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = React.useState(false);
  const [isVisitModalOpen, setIsVisitModalOpen] = React.useState(false);
  const [isWholesaleOrderModalOpen, setIsWholesaleOrderModalOpen] = React.useState(false);
  const [selectedCustomerForOrder, setSelectedCustomerForOrder] = React.useState<WholesaleCustomer | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [detailCustomer, setDetailCustomer] = React.useState<WholesaleCustomer | null>(null);
  const [editingCustomerId, setEditingCustomerId] = React.useState<string | null>(null);
  const [customerForm, setCustomerForm] = React.useState<CustomerFormState>(createEmptyCustomerForm());
  const [visitForm, setVisitForm] = React.useState<VisitFormState>(createEmptyVisitForm());
  const [isPending, startTransition] = React.useTransition();
  const [isLoading, setIsLoading] = React.useState(true);
  const [locationState, setLocationState] = React.useState<LocationState>({
    status: "idle",
    coordinates: null,
    country: "سوريا",
  });
  const isUserAdmin = isAdmin(user);

  const availableCities = React.useMemo(() => {
    if (!isWholesaleCountry(customerForm.country)) return [];
    return WHOLESALE_CITIES_BY_COUNTRY[customerForm.country];
  }, [customerForm.country]);

  const canAccessWholesale = React.useMemo(() => {
    if (!user) return false;
    return hasAnyPermission(user, ["viewWholesaleCustomers", "addWholesaleCustomers", "editWholesaleCustomers", "deleteWholesaleCustomers"]);
  }, [user]);

  const canAddWholesale = Boolean(user && hasPermission(user, "addWholesaleCustomers"));
  const canEditWholesale = Boolean(user && hasPermission(user, "editWholesaleCustomers"));
  const canDeleteWholesale = Boolean(user && hasPermission(user, "deleteWholesaleCustomers"));
  const canCreateWholesaleOrder = Boolean(user && hasPermission(user, "addWholesaleOrders"));
  const canRegisterVisit = canEditWholesale || canAddWholesale;

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    const [customersResponse, repsResponse] = await Promise.all([
      getWholesaleCustomers(),
      getWholesaleSalesReps(),
    ]);

    if (!customersResponse.success) {
      toast.error(customersResponse.error || "تعذر تحميل عملاء الجملة");
    } else {
      setCustomers((customersResponse.data as WholesaleCustomer[]) || []);
    }

    if (!repsResponse.success) {
      toast.error(repsResponse.error || "تعذر تحميل المندوبين");
    } else {
      setSalesReps((repsResponse.data as SalesRep[]) || []);
    }

    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (!canAccessWholesale) {
      setIsLoading(false);
      return;
    }
    void loadData();
  }, [canAccessWholesale, loadData, loading]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setLocationState({
        status: "unsupported",
        coordinates: null,
        country: "سوريا",
      });
      return;
    }

    let isActive = true;
    setLocationState((current) => ({ ...current, status: "loading" }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isActive) return;
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const country = getCountryFromCoordinates(latitude, longitude);
        setLocationState({
          status: "ready",
          coordinates: { latitude, longitude },
          country,
        });
      },
      (error) => {
        if (!isActive) return;
        setLocationState({
          status: error.code === error.PERMISSION_DENIED ? "denied" : "error",
          coordinates: null,
          country: "سوريا",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );

    return () => {
      isActive = false;
    };
  }, []);

  const visibleCustomers = React.useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch = !normalizedSearch
        ? true
        : [
            customer.name,
            customer.contactName,
            customer.city,
            customer.area,
            customer.country,
            customer.address,
            customer.assignedUser?.username,
            getCategoryLabel(customer.category, customer.categoryOther),
            ...customer.phone,
          ]
            .filter(Boolean)
            .some((item) => String(item).toLowerCase().includes(normalizedSearch));

      const matchesCategory = selectedCategory === "ALL" || customer.category === selectedCategory;
      const matchesStatus = selectedStatus === "ALL" || customer.visitStatus === selectedStatus;
      const matchesRep = selectedRepId === "ALL" || customer.assignedUserId === selectedRepId;

      return matchesSearch && matchesCategory && matchesStatus && matchesRep;
    });
  }, [customers, deferredSearch, selectedCategory, selectedRepId, selectedStatus]);

  const selectedCustomer = React.useMemo(() => {
    return visibleCustomers.find((customer) => customer.id === selectedCustomerId) ?? visibleCustomers[0] ?? null;
  }, [selectedCustomerId, visibleCustomers]);

  React.useEffect(() => {
    setPage(1);
  }, [deferredSearch, selectedCategory, selectedRepId, selectedStatus]);

  React.useEffect(() => {
    if (!selectedCustomer && visibleCustomers.length === 0) {
      setSelectedCustomerId(null);
      return;
    }
    if (!selectedCustomer && visibleCustomers.length > 0) {
      setSelectedCustomerId(visibleCustomers[0].id);
    }
  }, [selectedCustomer, visibleCustomers]);

  const stats = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const total = visibleCustomers.length;
    const todayVisits = visibleCustomers.reduce((count, customer) => {
      return count + customer.visits.filter((visit) => {
        const visitedAt = new Date(visit.visitedAt);
        return !Number.isNaN(visitedAt.getTime()) && visitedAt >= startOfToday;
      }).length;
    }, 0);
    const hotLeads = visibleCustomers.filter((customer) => customer.lastVisitResult === "VERY_INTERESTED").length;
    const monthlySales = visibleCustomers.reduce((count, customer) => {
      return count + customer.visits.filter((visit) => {
        const visitedAt = new Date(visit.visitedAt);
        return !Number.isNaN(visitedAt.getTime())
          && visitedAt >= startOfMonth
          && (visit.orderPlaced || visit.result === "PURCHASED");
      }).length;
    }, 0);

    return { total, todayVisits, hotLeads, monthlySales };
  }, [visibleCustomers]);

  const selectedSalesRep = React.useMemo(() => {
    return salesReps.find((rep) => rep.id === customerForm.assignedUserId) ?? null;
  }, [customerForm.assignedUserId, salesReps]);

  const mapLinkCoordinates = React.useMemo(() => {
    return parseMapLinkCoordinates(customerForm.googleMapsLink);
  }, [customerForm.googleMapsLink]);

  const allowedCountriesForAssignee = React.useMemo<WholesaleCountry[]>(() => {
    const scopedCountries = getAllowedCountriesFromUser(selectedSalesRep ?? user);
    return scopedCountries.length > 0 ? scopedCountries : [...WHOLESALE_COUNTRY_OPTIONS];
  }, [selectedSalesRep, user]);

  const resolvedCustomerCountry = React.useMemo<WholesaleCountry>(() => {
    const linkCountry = mapLinkCoordinates
      ? getCountryFromCoordinates(mapLinkCoordinates.latitude, mapLinkCoordinates.longitude)
      : null;

    if (linkCountry && allowedCountriesForAssignee.includes(linkCountry)) {
      return linkCountry;
    }

    if (isWholesaleCountry(customerForm.country) && allowedCountriesForAssignee.includes(customerForm.country)) {
      return customerForm.country;
    }

    if (locationState.coordinates && allowedCountriesForAssignee.includes(locationState.country)) {
      return locationState.country;
    }

    return allowedCountriesForAssignee[0] ?? "سوريا";
  }, [allowedCountriesForAssignee, customerForm.country, locationState.coordinates, locationState.country, mapLinkCoordinates]);

  React.useEffect(() => {
    setCustomerForm((current) => {
      if (current.country === resolvedCustomerCountry) return current;
      return {
        ...current,
        country: resolvedCustomerCountry,
        city: WHOLESALE_CITIES_BY_COUNTRY[resolvedCustomerCountry].includes(current.city) ? current.city : "",
      };
    });
  }, [resolvedCustomerCountry]);

  const mapCountry = React.useMemo<WholesaleCountry>(() => {
    if (mapLinkCoordinates) {
      return getCountryFromCoordinates(mapLinkCoordinates.latitude, mapLinkCoordinates.longitude);
    }
    return resolvedCustomerCountry;
  }, [mapLinkCoordinates, resolvedCustomerCountry]);

  const mapCoordinates = React.useMemo<GeoCoordinates>(() => {
    if (mapLinkCoordinates) {
      return mapLinkCoordinates;
    }

    const latitude = parseOptionalNumber(customerForm.latitude);
    const longitude = parseOptionalNumber(customerForm.longitude);

    if (latitude !== null && longitude !== null) {
      return { latitude, longitude };
    }

    if (locationState.coordinates) {
      return locationState.coordinates;
    }

    return COUNTRY_MAP_CONFIG[mapCountry].center;
  }, [customerForm.latitude, customerForm.longitude, locationState.coordinates, mapCountry, mapLinkCoordinates]);

  const mapEmbedUrl = React.useMemo(() => {
    const hasManualCoordinates = parseOptionalNumber(customerForm.latitude) !== null && parseOptionalNumber(customerForm.longitude) !== null;
    return createMapEmbedUrl(mapCoordinates, mapCountry, hasManualCoordinates || locationState.status === "ready");
  }, [customerForm.latitude, customerForm.longitude, locationState.status, mapCoordinates, mapCountry]);

  const canUseCurrentLocation = locationState.coordinates !== null;

  function applyCoordinatesToCustomerForm(coordinates: GeoCoordinates, country: WholesaleCountry) {
    const nextCountry = allowedCountriesForAssignee.includes(country)
      ? country
      : (allowedCountriesForAssignee[0] ?? country);

    setCustomerForm((current) => ({
      ...current,
      country: nextCountry,
      city: WHOLESALE_CITIES_BY_COUNTRY[nextCountry].includes(current.city) ? current.city : "",
      latitude: formatCoordinate(coordinates.latitude),
      longitude: formatCoordinate(coordinates.longitude),
      googleMapsLink: createGoogleMapsLink(coordinates.latitude, coordinates.longitude),
    }));
  }

  function openCreateCustomerModal() {
    setEditingCustomerId(null);
    const nextForm = createEmptyCustomerForm();
    nextForm.assignedUserId = isUserAdmin ? "" : (user?.id || "");
    if (locationState.coordinates) {
      const country = locationState.country;
      nextForm.country = country;
      nextForm.latitude = formatCoordinate(locationState.coordinates.latitude);
      nextForm.longitude = formatCoordinate(locationState.coordinates.longitude);
      nextForm.googleMapsLink = createGoogleMapsLink(locationState.coordinates.latitude, locationState.coordinates.longitude);
    }
    setCustomerForm(nextForm);
    setIsCustomerModalOpen(true);
  }

  function openEditCustomerModal(customer: WholesaleCustomer) {
    setEditingCustomerId(customer.id);
    setCustomerForm({
      name: customer.name,
      category: customer.category,
      categoryOther: customer.categoryOther || "",
      contactName: customer.contactName || "",
      contactRole: customer.contactRole || "OWNER",
      contactRoleOther: customer.contactRoleOther || "",
      phoneNumbers: customer.phone.length > 0 ? customer.phone : [""],
      country: isWholesaleCountry(customer.country || "") ? customer.country || "سوريا" : "سوريا",
      city: customer.city || "",
      area: customer.area || "",
      address: customer.address || "",
      latitude: customer.latitude?.toString() || "",
      longitude: customer.longitude?.toString() || "",
      googleMapsLink: customer.googleMapsLink || "",
      assignedUserId: customer.assignedUserId || "",
      notes: customer.notes || "",
      preferredVisitAt: toDateTimeLocalValue(customer.preferredVisitAt),
      nextFollowUpAt: toDateTimeLocalValue(customer.nextFollowUpAt),
      visitStatus: customer.visitStatus,
      isActive: customer.isActive,
    });
    setIsCustomerModalOpen(true);
  }

  function openVisitModal(customer: WholesaleCustomer) {
    setSelectedCustomerId(customer.id);
    setVisitForm({
      ...createEmptyVisitForm(),
      userId: customer.assignedUserId || user?.id || "",
      nextFollowUpAt: toDateTimeLocalValue(customer.nextFollowUpAt),
    });
    setIsVisitModalOpen(true);
  }

  function openVisitModalForCustomerData(customer: Pick<WholesaleCustomer, "id" | "assignedUserId" | "nextFollowUpAt">) {
    setSelectedCustomerId(customer.id);
    setVisitForm({
      ...createEmptyVisitForm(),
      userId: customer.assignedUserId || user?.id || "",
      nextFollowUpAt: toDateTimeLocalValue(customer.nextFollowUpAt),
    });
    setIsVisitModalOpen(true);
  }

  function openWholesaleOrderModal(customer: WholesaleCustomer) {
    setSelectedCustomerForOrder(customer);
    setIsWholesaleOrderModalOpen(true);
  }

  function closeWholesaleOrderModal() {
    setIsWholesaleOrderModalOpen(false);
    setSelectedCustomerForOrder(null);
  }

  function openDetailModal(customer: WholesaleCustomer) {
    setDetailCustomer(customer);
    setIsDetailModalOpen(true);
  }

  function closeDetailModal() {
    setIsDetailModalOpen(false);
    setDetailCustomer(null);
  }

  function handleVisitResultChange(value: string) {
    setVisitForm((current) => ({
      ...current,
      result: value,
      nextFollowUpAt: isFollowUpResult(value) ? current.nextFollowUpAt : "",
      followUpType: requiresFollowUpType(value) ? (current.followUpType || "VISIT") : "",
      followUpNotes: isFollowUpResult(value) ? current.followUpNotes : "",
      rejectionReasonCode: isRejectedResult(value) ? current.rejectionReasonCode : "",
      rejectionReasonOther: isRejectedResult(value) ? current.rejectionReasonOther : "",
    }));
  }

  function resetFilters() {
    setSearch("");
    setSelectedCategory("ALL");
    setSelectedStatus("ALL");
    setSelectedRepId("ALL");
  }

  function handleCustomerPhoneChange(index: number, value?: string) {
    setCustomerForm((current) => ({
      ...current,
      phoneNumbers: current.phoneNumbers.map((phone, phoneIndex) => (phoneIndex === index ? value || "" : phone)),
    }));
  }

  function addCustomerPhoneField() {
    setCustomerForm((current) => {
      if (current.phoneNumbers.length >= 2) return current;
      return {
        ...current,
        phoneNumbers: [...current.phoneNumbers, ""],
      };
    });
  }

  function removeCustomerPhoneField(index: number) {
    setCustomerForm((current) => {
      const nextPhones = current.phoneNumbers.filter((_, phoneIndex) => phoneIndex !== index);
      return {
        ...current,
        phoneNumbers: nextPhones.length > 0 ? nextPhones : [""],
      };
    });
  }

  function handleCustomerVisitStatusChange(value: string) {
    const nextForm = {
      ...customerForm,
      visitStatus: value,
      preferredVisitAt: value === "PLANNED" ? customerForm.preferredVisitAt : "",
      nextFollowUpAt: value === "VISITED" ? customerForm.nextFollowUpAt : "",
    };

    setCustomerForm(nextForm);

    if (value === "VISITED" && !editingCustomerId && isCustomerModalOpen) {
      handleSaveCustomer(nextForm, {
        openVisitModalOnSuccess: true,
        successMessage: "تم حفظ بيانات العميل",
      });
    }
  }

  function handleUseCurrentLocation() {
    if (!locationState.coordinates) {
      toast.error("تعذر تحديد الموقع الحالي للمسؤول");
      return;
    }

    applyCoordinatesToCustomerForm(locationState.coordinates, locationState.country);
    toast.success("تم استخدام موقع المسؤول الحالي على الخريطة");
  }

  function handleSaveCustomer(
    formState: CustomerFormState = customerForm,
    options?: { openVisitModalOnSuccess?: boolean; successMessage?: string }
  ) {
    if (!formState.name.trim()) {
      toast.error("اسم عميل الجملة مطلوب");
      return;
    }

    const normalizedPhones = normalizePhoneListInput(formState.phoneNumbers);
    if (normalizedPhones.length === 0) {
      toast.error("أدخل رقم هاتف واحد على الأقل");
      return;
    }

    startTransition(async () => {
      const manualMapCoordinates = parseMapLinkCoordinates(formState.googleMapsLink);
      const fallbackMapLink = createGoogleMapsLink(mapCoordinates.latitude, mapCoordinates.longitude);
      const latitude = manualMapCoordinates?.latitude ?? parseOptionalNumber(formState.latitude) ?? mapCoordinates.latitude;
      const longitude = manualMapCoordinates?.longitude ?? parseOptionalNumber(formState.longitude) ?? mapCoordinates.longitude;
      const googleMapsLink = formState.googleMapsLink.trim() || fallbackMapLink;

      const payload = {
        name: formState.name,
        category: formState.category,
        activityKey: formState.category,
        categoryOther: formState.categoryOther,
        contactName: formState.contactName,
        contactRole: formState.contactRole,
        contactRoleOther: formState.contactRole === "OTHER" ? formState.contactRoleOther : "",
        phone: normalizedPhones,
        country: resolvedCustomerCountry,
        city: formState.city,
        area: formState.area,
        address: formState.address,
        latitude,
        longitude,
        googleMapsLink,
        assignedUserId: formState.assignedUserId,
        notes: formState.notes,
        preferredVisitAt: formState.visitStatus === "PLANNED" ? formState.preferredVisitAt : "",
        nextFollowUpAt: formState.visitStatus === "VISITED" ? formState.nextFollowUpAt : "",
        visitStatus: formState.visitStatus,
        isActive: formState.isActive,
      };

      const response = editingCustomerId
        ? await updateWholesaleCustomer(editingCustomerId, payload)
        : await createWholesaleCustomer(payload);

      if (!response.success) {
        toast.error(response.error || "تعذر حفظ عميل الجملة");
        return;
      }

      const savedCustomer = (response.data as WholesaleCustomer | undefined) ?? null;
      toast.success(options?.successMessage || (editingCustomerId ? "تم تعديل العميل" : "تمت إضافة عميل جديد"));
      setIsCustomerModalOpen(false);
      const savedCustomerId = savedCustomer?.id ?? editingCustomerId;
      if (savedCustomerId) {
        setSelectedCustomerId(savedCustomerId);
      }
      if (options?.openVisitModalOnSuccess && savedCustomerId) {
        openVisitModalForCustomerData({
          id: savedCustomerId,
          assignedUserId: savedCustomer?.assignedUserId ?? (payload.assignedUserId || null),
          nextFollowUpAt: savedCustomer?.nextFollowUpAt ?? (payload.nextFollowUpAt || null),
        });
      }
      await loadData();
    });
  }

  function handleSaveVisit() {
    if (!selectedCustomerId) {
      toast.error("اختر العميل أولاً");
      return;
    }

    if (isFollowUpResult(visitForm.result) && !visitForm.nextFollowUpAt) {
      toast.error("حدد موعد المتابعة");
      return;
    }

    if (requiresFollowUpType(visitForm.result) && !visitForm.followUpType) {
      toast.error("حدد نوع المتابعة");
      return;
    }

    if (isFollowUpResult(visitForm.result) && !visitForm.followUpNotes.trim()) {
      toast.error("حدد الإجراء القادم");
      return;
    }

    if (isRejectedResult(visitForm.result) && !visitForm.rejectionReasonCode) {
      toast.error("حدد سبب عدم التعاون");
      return;
    }

    if (visitForm.rejectionReasonCode === "OTHER" && !visitForm.rejectionReasonOther.trim()) {
      toast.error("اكتب سبب عدم التعاون");
      return;
    }

    startTransition(async () => {
      const response = await createWholesaleVisit({
        wholesaleCustomerId: selectedCustomerId,
        userId: visitForm.userId || undefined,
        visitedAt: visitForm.visitedAt,
        result: visitForm.result,
        notes: visitForm.notes,
        nextFollowUpAt: visitForm.nextFollowUpAt,
        followUpType: visitForm.followUpType,
        followUpNotes: visitForm.followUpNotes,
        rejectionReasonCode: visitForm.rejectionReasonCode,
        rejectionReasonOther: visitForm.rejectionReasonOther,
      });

      if (!response.success) {
        toast.error(response.error || "تعذر تسجيل الزيارة");
        return;
      }

      toast.success("تم تسجيل الزيارة بنجاح");
      setIsVisitModalOpen(false);
      await loadData();
    });
  }

  function handleDeleteCustomer(customer: WholesaleCustomer) {
    const confirmed = window.confirm(`هل تريد حذف عميل الجملة ${customer.name}؟`);
    if (!confirmed) return;

    startTransition(async () => {
      const response = await deleteWholesaleCustomer(customer.id);
      if (!response.success) {
        toast.error(response.error || "تعذر حذف عميل الجملة");
        return;
      }

      toast.success("تم حذف عميل الجملة");
      if (selectedCustomerId === customer.id) {
        setSelectedCustomerId(null);
      }
      await loadData();
    });
  }

  const tableColumns = React.useMemo<Column<WholesaleCustomer>[]>(() => [
    {
      header: "العميل",
      accessor: (customer) => {
        const isSelected = selectedCustomer?.id === customer.id;
        return (
          <button
            type="button"
            onClick={() => {
              setSelectedCustomerId(customer.id);
              openDetailModal(customer);
            }}
            className={`inline-flex max-w-full items-center gap-2 rounded-xl px-2 py-1 text-right transition ${isSelected ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200" : "text-slate-900 dark:text-slate-100"}`}
          >
            <span className="truncate font-bold" title={customer.name}>{customer.name}</span>
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">{getCategoryLabel(customer.category, customer.categoryOther)}</span>
          </button>
        );
      },
      className: "min-w-[230px]",
    },
    {
      header: "جهة التواصل",
      accessor: (customer) => [customer.contactName || "-", getContactRoleLabel(customer.contactRole, customer.contactRoleOther)].filter(Boolean).join(" - "),
      className: "min-w-[170px]",
    },
    {
      header: "الأرقام",
      accessor: (customer) => {
        const uniquePhones = getUniqueDisplayPhones(customer.phone);
        return uniquePhones.length > 0 ? uniquePhones.join(" / ") : "-";
      },
      className: "min-w-[220px]",
    },
    {
      header: "المنطقة",
      accessor: (customer) => [customer.country, customer.city, customer.area].filter(Boolean).join(" - ") || "-",
      className: "min-w-[190px]",
    },
    {
      header: "المندوب",
      accessor: (customer) => customer.assignedUser?.username || "غير مسند",
      className: "min-w-[120px]",
    },
    {
      header: "آخر نتيجة",
      accessor: (customer) => getVisitResultLabel(customer.lastVisitResult),
      className: "min-w-[130px]",
    },
    {
      header: "المتابعة",
      accessor: (customer) => [getVisitStatusLabel(customer.visitStatus), formatDateLabel(customer.nextFollowUpAt)].filter(Boolean).join(" - "),
      className: "min-w-[210px]",
    },
  ], [selectedCustomer]);

  const tableActions = React.useMemo<TableAction<WholesaleCustomer>[]>(() => {
    const actions: TableAction<WholesaleCustomer>[] = [];

    if (canEditWholesale) {
      actions.push({
        label: "تعديل",
        icon: <Pencil className="h-4 w-4" />,
        onClick: (customer) => openEditCustomerModal(customer),
      });
    }

    if (canRegisterVisit) {
      actions.push({
        label: "زيارة",
        icon: <Plus className="h-4 w-4" />,
        onClick: (customer) => openVisitModal(customer),
      });
    }

    if (canCreateWholesaleOrder) {
      actions.push({
        label: "طلب جملة",
        icon: <FilePlus2 className="h-4 w-4" />,
        onClick: (customer) => openWholesaleOrderModal(customer),
      });
    }

    if (canDeleteWholesale) {
      actions.push({
        label: "حذف",
        icon: <Trash2 className="h-4 w-4" />,
        variant: "danger",
        onClick: (customer) => handleDeleteCustomer(customer),
      });
    }

    return actions;
  }, [canCreateWholesaleOrder, canDeleteWholesale, canEditWholesale, canRegisterVisit, handleDeleteCustomer, openEditCustomerModal, openVisitModal]);

  if (loading || isLoading) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          جاري تحميل صفحة عملاء الجملة...
        </div>
      </div>
    );
  }

  if (!canAccessWholesale) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          لا تملك صلاحية الوصول إلى صفحة عملاء الجملة.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8" dir="rtl">
      <section className="rounded-[32px] border border-slate-200 bg-gradient-to-l from-teal-600 via-cyan-600 to-blue-700 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-bold backdrop-blur">
              <Building2 className="h-4 w-4" />
              إدارة عملاء الجملة
            </div>
            <div>
              <h1 className="text-2xl font-black md:text-4xl">متابعة المندوبين وزيارات العملاء في شاشة واحدة</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/85 md:text-base">
                أضف عميل الجملة، اسنده إلى مندوب، سجّل نتائج الزيارة، وحدد المتابعة القادمة وفق آلية العمل الظاهرة في المخطط.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="md" onClick={() => selectedCustomer && openVisitModal(selectedCustomer)} leftIcon={<ClipboardList className="h-4 w-4" />} disabled={!selectedCustomer}>
              تسجيل زيارة
            </Button>
            <Button variant="primary" size="md" onClick={openCreateCustomerModal} leftIcon={<Plus className="h-4 w-4" />} className="bg-white text-blue-700 hover:bg-blue-50" disabled={!canAddWholesale}>
              إضافة عميل جديد
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="إجمالي العملاء" value={stats.total} icon={<Building2 className="h-5 w-5" />} tone="blue" />
        <StatCard title="زيارات اليوم" value={stats.todayVisits} icon={<CalendarClock className="h-5 w-5" />} tone="amber" />
        <StatCard title="الفرص الساخنة" value={stats.hotLeads} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard title="المبيعات هذا الشهر" value={stats.monthlySales} icon={<ClipboardList className="h-5 w-5" />} tone="fuchsia" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">خريطة المسؤول الميداني</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{getLocationStatusMessage(locationState.status)}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <MapPin className="h-3.5 w-3.5" />
              {mapCountry}
            </div>
          </div>

          <iframe
            title="خريطة صفحة عملاء الجملة"
            src={mapEmbedUrl}
            className="h-[320px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <InfoCard icon={<MapPin className="h-4 w-4" />} label="الدولة الافتراضية" value={mapCountry} />
          <InfoCard icon={<MapPin className="h-4 w-4" />} label="خط العرض الحالي" value={formatCoordinate(mapCoordinates.latitude)} />
          <InfoCard icon={<MapPin className="h-4 w-4" />} label="خط الطول الحالي" value={formatCoordinate(mapCoordinates.longitude)} />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className={`grid gap-3 ${isUserAdmin ? "lg:grid-cols-[2fr,1fr,1fr,1fr,auto]" : "lg:grid-cols-[2fr,1fr,1fr,auto]"}`}>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">بحث</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو المدينة أو المندوب أو رقم الهاتف"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-950"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">نوع النشاط</label>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-950"
            >
              <option value="ALL">الكل</option>
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">حالة المتابعة</label>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-950"
            >
              <option value="ALL">الكل</option>
              {VISIT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {isUserAdmin && (
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">المندوب</label>
            <select
              value={selectedRepId}
              onChange={(event) => setSelectedRepId(event.target.value)}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-950"
            >
              <option value="ALL">الكل</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>{rep.username}</option>
              ))}
            </select>
          </div>
          )}

          <div className="flex items-end">
            <Button variant="outline" size="md" onClick={resetFilters} className="w-full lg:w-auto">
              إعادة الضبط
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">قائمة عملاء الجملة</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{visibleCustomers.length} عميل ظاهر حسب الفلاتر والصلاحيات</p>
            </div>
          </div>

          <DataTable
            data={visibleCustomers}
            columns={tableColumns}
            actions={tableActions.length > 0 ? tableActions : undefined}
            actindir={true}
            totalCount={visibleCustomers.length}
            pageSize={PAGE_SIZE}
            currentPage={page}
            onPageChange={setPage}
            isLoading={isLoading || isPending}
          />
        </div>
      </section>

      <AppModal
        isOpen={isDetailModalOpen}
        onClose={closeDetailModal}
        title={detailCustomer ? detailCustomer.name : "تفاصيل العميل"}
        size="xl"
      >
        {detailCustomer && (
          <div className="space-y-5" dir="rtl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{detailCustomer.name}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{getCategoryLabel(detailCustomer.category, detailCustomer.categoryOther)}</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {getVisitStatusLabel(detailCustomer.visitStatus)}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard icon={<Building2 className="h-4 w-4" />} label="نوع النشاط" value={getCategoryLabel(detailCustomer.category, detailCustomer.categoryOther)} />
              <InfoCard icon={<UserRound className="h-4 w-4" />} label="المندوب" value={detailCustomer.assignedUser?.username || "غير مسند"} />
              <InfoCard icon={<Phone className="h-4 w-4" />} label="هاتف" value={detailCustomer.phone.map(formatPhoneForDisplay).join(" - ") || "-"} />
              <InfoCard icon={<MapPin className="h-4 w-4" />} label="المنطقة" value={[detailCustomer.country, detailCustomer.city, detailCustomer.area].filter(Boolean).join(" - ") || "-"} />
              <InfoCard icon={<CalendarClock className="h-4 w-4" />} label="المتابعة القادمة" value={formatDateLabel(detailCustomer.nextFollowUpAt)} />
            </div>

            <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900">
              <div className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">ملاحظات العميل</div>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{detailCustomer.notes || "لا توجد ملاحظات مسجلة"}</p>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">سجل الزيارات</h3>
              <Button variant="outline" size="sm" onClick={() => { closeDetailModal(); openVisitModal(detailCustomer); }} leftIcon={<Plus className="h-3.5 w-3.5" />} disabled={!canRegisterVisit}>
                إضافة زيارة
              </Button>
            </div>

            <div className="space-y-3">
              {detailCustomer.visits.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  لا توجد زيارات مسجلة لهذا العميل بعد.
                </div>
              )}

              {detailCustomer.visits.map((visit) => (
                <div key={visit.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{getVisitResultLabel(visit.result)}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateLabel(visit.visitedAt)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{getVisitStatusLabel(visit.status)}</span>
                      {visit.orderPlaced && <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">تم الشراء</span>}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <div>المندوب: {visit.user?.username || "غير محدد"}</div>
                    <div>المتابعة التالية: {formatDateLabel(visit.nextFollowUpAt)}</div>
                    <div>نوع المتابعة: {getFollowUpTypeLabel(visit.followUpType)}</div>
                    <div>الملاحظات: {visit.notes || "-"}</div>
                    <div>الإجراء القادم: {visit.followUpNotes || "-"}</div>
                    {visit.rejectionReasonCode && <div>سبب عدم التعاون: {getRejectionReasonLabel(visit.rejectionReasonCode, visit.rejectionReasonOther)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AppModal>

      <AppModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title={editingCustomerId ? "تعديل العميل" : "إضافة عميل جديد"}
        description="أدخل بيانات الجهة المستهدفة والمسؤول ميداني عنها."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCustomerModalOpen(false)}>إلغاء</Button>
            <Button onClick={() => handleSaveCustomer()} isLoading={isPending}>حفظ البيانات</Button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم النشاط">
            <input value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))} className="field-input" />
          </Field>
          <Field label="نوع النشاط">
            <select value={customerForm.category} onChange={(event) => setCustomerForm((current) => ({ ...current, category: event.target.value }))} className="field-input">
              {!ACTIVITY_OPTIONS.some((option) => option.value === customerForm.category) && (
                <option value={customerForm.category}>{getCategoryLabel(customerForm.category, customerForm.categoryOther)}</option>
              )}
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          {customerForm.category === "OTHER" && (
            <Field label="ما هو نوع النشاط؟">
              <input value={customerForm.categoryOther} onChange={(event) => setCustomerForm((current) => ({ ...current, categoryOther: event.target.value }))} className="field-input" placeholder="اكتب نوع النشاط" />
            </Field>
          )}
          <Field label="اسم جهة التواصل">
            <input value={customerForm.contactName} onChange={(event) => setCustomerForm((current) => ({ ...current, contactName: event.target.value }))} className="field-input" />
          </Field>
          <Field label="صفة جهة الاتصال">
            <select value={customerForm.contactRole} onChange={(event) => setCustomerForm((current) => ({ ...current, contactRole: event.target.value, contactRoleOther: event.target.value === "OTHER" ? current.contactRoleOther : "" }))} className="field-input">
              {CONTACT_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          {customerForm.contactRole === "OTHER" && (
            <Field label="ما هي الصفة؟">
              <input value={customerForm.contactRoleOther} onChange={(event) => setCustomerForm((current) => ({ ...current, contactRoleOther: event.target.value }))} className="field-input" placeholder="اكتب صفة جهة الاتصال" />
            </Field>
          )}
          {isUserAdmin ? (
          <Field label="المسؤول ميداني">
            <select value={customerForm.assignedUserId} onChange={(event) => setCustomerForm((current) => ({ ...current, assignedUserId: event.target.value }))} className="field-input">
              <option value="">غير مسند</option>
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>{rep.username}</option>
              ))}
            </select>
          </Field>
          ) : (
          <Field label="المسؤول ميداني">
            <input value={user?.username || ""} className="field-input" disabled />
          </Field>
          )}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">بيانات التواصل</label>
              {customerForm.phoneNumbers.length < 2 && (
                <button
                  type="button"
                  onClick={addCustomerPhoneField}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة رقم إضافي
                </button>
              )}
            </div>

            <div className="space-y-3">
              {customerForm.phoneNumbers.map((phone, index) => (
                <div key={`customer-phone-${index}`} className="flex items-start gap-2">
                  <div className="flex-1" dir="ltr">
                    <div className="mb-1 text-right text-xs font-bold text-slate-500 dark:text-slate-400" dir="rtl">
                      {index === 0 ? "رقم الأساسي" : "رقم إضافي"}
                    </div>
                    <PhoneInput
                      international
                      withCountryCallingCode
                      defaultCountry={getPhoneDefaultCountry(resolvedCustomerCountry)}
                      value={phone || undefined}
                      onChange={(value) => handleCustomerPhoneChange(index, value)}
                      className="PhoneInput"
                      numberInputProps={{
                        className: "field-input",
                        placeholder: index === 0 ? "أدخل الرقم الأساسي" : "أدخل الرقم الإضافي",
                      }}
                    />
                  </div>

                  {customerForm.phoneNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCustomerPhoneField(index)}
                      className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                      aria-label="حذف رقم الهاتف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <Field label="رابط الخريطة">
            <input
              value={customerForm.googleMapsLink}
              onChange={(event) => setCustomerForm((current) => ({ ...current, googleMapsLink: event.target.value }))}
              className="field-input"
              placeholder="ألصق رابط Google Maps أو اتركه فارغًا لاستخدام الخريطة الحالية"
              dir="ltr"
            />
          </Field>
          <Field label="البلد">
            <select value={customerForm.country} onChange={(event) => setCustomerForm((current) => ({ ...current, country: event.target.value }))} className="field-input">
              {allowedCountriesForAssignee.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </Field>
          <Field label="المدينة">
            <select value={customerForm.city} onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))} className="field-input" disabled={!customerForm.country}>
              <option value="">اختر المدينة</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </Field>
          <Field label="المنطقة">
            <input value={customerForm.area} onChange={(event) => setCustomerForm((current) => ({ ...current, area: event.target.value }))} className="field-input" />
          </Field>
          <div className="md:col-span-2 space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-slate-100">موقع المسؤول على الخريطة</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {getLocationStatusMessage(locationState.status)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleUseCurrentLocation} disabled={!canUseCurrentLocation} leftIcon={<MapPin className="h-3.5 w-3.5" />}>
                  استخدام موقعي الحالي
                </Button>
                <a
                  href={customerForm.googleMapsLink.trim() || createGoogleMapsLink(mapCoordinates.latitude, mapCoordinates.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  فتح في Google Maps
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
              <iframe
                title="خريطة موقع المسؤول"
                src={mapEmbedUrl}
                className="h-[280px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">الدولة المعتمدة</div>
                <div className="mt-1 font-bold text-slate-900 dark:text-slate-100">{resolvedCustomerCountry}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">خط العرض</div>
                <div className="mt-1 font-bold text-slate-900 dark:text-slate-100">{customerForm.latitude || formatCoordinate(mapCoordinates.latitude)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">خط الطول</div>
                <div className="mt-1 font-bold text-slate-900 dark:text-slate-100">{customerForm.longitude || formatCoordinate(mapCoordinates.longitude)}</div>
              </div>
            </div>
          </div>
          <Field label="حالة العميل">
            <select value={customerForm.visitStatus} onChange={(event) => handleCustomerVisitStatusChange(event.target.value)} className="field-input">
              {VISIT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="الحالة">
            <label className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <input type="checkbox" checked={customerForm.isActive} onChange={(event) => setCustomerForm((current) => ({ ...current, isActive: event.target.checked }))} />
              نشط وقابل للمتابعة
            </label>
          </Field>
          {customerForm.visitStatus === "PLANNED" && (
            <Field label="الزيارة المفضلة">
              <input type="datetime-local" value={customerForm.preferredVisitAt} onChange={(event) => setCustomerForm((current) => ({ ...current, preferredVisitAt: event.target.value }))} className="field-input" />
            </Field>
          )}
          {customerForm.visitStatus === "VISITED" && (
            <Field label="المتابعة القادمة">
              <input type="datetime-local" value={customerForm.nextFollowUpAt} onChange={(event) => setCustomerForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} className="field-input" />
            </Field>
          )}
          {customerForm.visitStatus === "VISITED" && (
            <div className="md:col-span-2">
              <Field label="تفاصيل إضافية">
                <textarea value={customerForm.notes} onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))} className="field-input min-h-[110px]" />
              </Field>
            </div>
          )}
        </div>
      </AppModal>

      <AppModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        title="تسجيل زيارة ميدانية"
        description={selectedCustomer ? `العميل: ${selectedCustomer.name}` : "سجل نتائج الزيارة والمتابعة القادمة"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsVisitModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveVisit} isLoading={isPending}>حفظ الزيارة</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">1. إنشاء العميل</div>
            <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-600 dark:text-slate-300">
              <div>اسم العميل: {selectedCustomer?.name || "-"}</div>
              <div>تاريخ الإنشاء: {formatDateLabel(selectedCustomer?.createdAt)}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">2. نوع النشاط</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{selectedCustomer ? getCategoryLabel(selectedCustomer.category, selectedCustomer.categoryOther) : "-"}</div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">3. بيانات التواصل</div>
            <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-600 dark:text-slate-300">
              <div>اسم جهة التواصل: {selectedCustomer?.contactName || "-"}</div>
              <div>صفة جهة الاتصال: {getContactRoleLabel(selectedCustomer?.contactRole, selectedCustomer?.contactRoleOther)}</div>
              <div>رقم الأساسي: {selectedCustomer?.phone[0] ? formatPhoneForDisplay(selectedCustomer.phone[0]) : "-"}</div>
              <div>رقم إضافي: {selectedCustomer?.phone[1] ? formatPhoneForDisplay(selectedCustomer.phone[1]) : "-"}</div>
              <div>العنوان: {[selectedCustomer?.city, selectedCustomer?.area, selectedCustomer?.address].filter(Boolean).join(" - ") || "-"}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">4. الملاحظات</div>
            <textarea value={visitForm.notes} onChange={(event) => setVisitForm((current) => ({ ...current, notes: event.target.value }))} className="field-input min-h-[100px]" placeholder={selectedCustomer?.notes || "أضف ملاحظات الزيارة هنا"} />
          </div>

          <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">5. نتيجة الزيارة</div>
            <div className="grid gap-4 md:grid-cols-2">
              {isUserAdmin ? (
                <Field label="المندوب">
                  <select value={visitForm.userId} onChange={(event) => setVisitForm((current) => ({ ...current, userId: event.target.value }))} className="field-input">
                    <option value="">غير محدد</option>
                    {salesReps.map((rep) => (
                      <option key={rep.id} value={rep.id}>{rep.username}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="المندوب">
                  <input value={user?.username || ""} className="field-input" disabled />
                </Field>
              )}
              <Field label="تاريخ الزيارة">
            <input type="datetime-local" value={visitForm.visitedAt} onChange={(event) => setVisitForm((current) => ({ ...current, visitedAt: event.target.value }))} className="field-input" />
          </Field>
              <Field label="نتيجة الزيارة">
            <select value={visitForm.result} onChange={(event) => handleVisitResultChange(event.target.value)} className="field-input">
              {VISIT_RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
              <Field label="الحالة بعد الزيارة">
            <select value={isRejectedResult(visitForm.result) || visitForm.result === "PURCHASED" ? "CLOSED" : isFollowUpResult(visitForm.result) ? "FOLLOW_UP_REQUIRED" : "VISITED"} className="field-input" disabled>
              {VISIT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
            </div>
          </div>

          {isFollowUpResult(visitForm.result) && (
            <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="mb-3 text-sm font-black text-slate-900 dark:text-slate-100">6. المتابعة القادمة</div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="موعد المتابعة">
                  <input type="datetime-local" value={visitForm.nextFollowUpAt} onChange={(event) => setVisitForm((current) => ({ ...current, nextFollowUpAt: event.target.value }))} className="field-input" />
                </Field>
                {requiresFollowUpType(visitForm.result) && (
                  <Field label="نوع المتابعة">
                    <select value={visitForm.followUpType} onChange={(event) => setVisitForm((current) => ({ ...current, followUpType: event.target.value }))} className="field-input">
                      <option value="">اختر النوع</option>
                      {FOLLOW_UP_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <div className="md:col-span-2">
                  <Field label="الإجراء القادم">
                    <textarea value={visitForm.followUpNotes} onChange={(event) => setVisitForm((current) => ({ ...current, followUpNotes: event.target.value }))} className="field-input min-h-[100px]" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {isRejectedResult(visitForm.result) && (
            <div className="rounded-3xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/20">
              <div className="mb-3 text-sm font-black text-red-700 dark:text-red-300">سبب عدم التعاون</div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="اختر السبب">
                  <select value={visitForm.rejectionReasonCode} onChange={(event) => setVisitForm((current) => ({ ...current, rejectionReasonCode: event.target.value }))} className="field-input">
                    <option value="">اختر السبب</option>
                    {REJECTION_REASON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                {visitForm.rejectionReasonCode === "OTHER" && (
                  <Field label="اكتب السبب">
                    <input value={visitForm.rejectionReasonOther} onChange={(event) => setVisitForm((current) => ({ ...current, rejectionReasonOther: event.target.value }))} className="field-input" />
                  </Field>
                )}
              </div>
            </div>
          )}
        </div>
      </AppModal>

      {selectedCustomerForOrder && (
        <WholesaleOrderCustomer
          customer={selectedCustomerForOrder}
          isOpen={isWholesaleOrderModalOpen}
          onClose={closeWholesaleOrderModal}
          onSuccess={loadData}
        />
      )}

      <style jsx>{`
        .field-input {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          color: rgb(15 23 42);
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.2s ease;
        }

        :global(.dark) .field-input {
          border-color: rgb(51 65 85);
          background: rgb(15 23 42);
          color: rgb(226 232 240);
        }

        .field-input::placeholder {
          color: rgb(148 163 184);
        }

        :global(.dark) .field-input::placeholder {
          color: rgb(100 116 139);
        }

        .field-input:focus {
          border-color: rgb(59 130 246);
          background: white;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }

        :global(.dark) .field-input:focus {
          background: rgb(2 6 23);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-bold text-slate-700 dark:text-slate-200">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "emerald" | "fuchsia";
}) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 text-blue-700 dark:from-blue-950/60 dark:to-cyan-950/40 dark:text-blue-300",
    amber: "from-amber-50 to-orange-50 text-amber-700 dark:from-amber-950/60 dark:to-orange-950/40 dark:text-amber-300",
    emerald: "from-emerald-50 to-green-50 text-emerald-700 dark:from-emerald-950/60 dark:to-green-950/40 dark:text-emerald-300",
    fuchsia: "from-fuchsia-50 to-pink-50 text-fuchsia-700 dark:from-fuchsia-950/60 dark:to-pink-950/40 dark:text-fuchsia-300",
  };

  return (
    <div className={`rounded-[28px] border border-slate-200 bg-gradient-to-br ${tones[tone]} p-5 shadow-sm dark:border-slate-800`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-500 dark:text-slate-300">{title}</div>
          <div className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{value}</div>
        </div>
        <div className="rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-slate-900/80">{icon}</div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
