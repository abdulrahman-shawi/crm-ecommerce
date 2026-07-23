"use client";

import * as React from "react";
import { getGeneralSettings } from "@/server/general-settings";

export type SiteCurrencySettings = {
  code: string;
  exchangeRate: number; // عدد وحدات عملة الموقع مقابل 1 دولار
};

export function getCurrencySymbol(currencyCode?: string | null) {
  switch (currencyCode) {
    case "USD":
      return "$";
    case "TRY":
      return "₺";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "SYP":
    case "LBP":
    case "IQD":
    case "JOD":
    case "EGP":
      return "";
    default:
      return "";
  }
}

export function formatSiteCurrency(
  amountInUsd: number,
  settings?: SiteCurrencySettings | null
) {
  const value = Number(amountInUsd || 0);
  if (!settings || settings.code === "USD" || settings.exchangeRate <= 0) {
    return `${value.toLocaleString()} $`;
  }
  const converted = value * settings.exchangeRate;
  const symbol = getCurrencySymbol(settings.code);
  return `${converted.toLocaleString()} ${symbol ? symbol + " " : ""}${settings.code}`;
}

export function convertUsdToSiteCurrency(
  amountInUsd: number,
  settings?: SiteCurrencySettings | null
) {
  const value = Number(amountInUsd || 0);
  if (!settings || settings.code === "USD" || settings.exchangeRate <= 0) {
    return value;
  }
  return value * settings.exchangeRate;
}

export function useSiteCurrency() {
  const [settings, setSettings] = React.useState<SiteCurrencySettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    getGeneralSettings()
      .then((res) => {
        if (!isMounted) return;
        const data = res?.data;
        setSettings({
          code: String(data?.siteCurrency || "USD").trim() || "USD",
          exchangeRate: Number(data?.usdToTryRate || 0),
        });
      })
      .catch(() => {
        if (isMounted) setSettings({ code: "USD", exchangeRate: 0 });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { settings, isLoading };
}
