import React from 'react';
import { getOrders, getOrdersByUser } from '@/server/order';
import { getCustomerList } from '@/server/customer';
import { getProductCatalog } from '@/server/product';
import { getshipping } from '@/server/shipping';

interface User {
  id: string;
  username?: string;
  name?: string;
}

export const useOrderData = (user?: User) => {
  const [products, setProduct] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSupportingDataLoading, setIsSupportingDataLoading] = React.useState(false);
  const supportingDataPromiseRef = React.useRef<Promise<void> | null>(null);

  const refreshOrders = async () => {
    setIsLoading(true);
    try {
      const ordersRes = await getOrders();
      setOrders(ordersRes?.success ? (ordersRes.data || []) : []);
    } catch (error) {
      console.error("Error refreshing orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    await refreshOrders();
  };

  // جلب طلبات عميل محدد
  const loadOrdersByCustomer = async (customerId: string) => {
    try {
      const res = await getOrdersByUser(customerId);
      if (res.success) {
        return res.data || [];
      }
      return [];
    } catch (error) {
      console.error("Error loading customer orders:", error);
      return [];
    }
  };

  const refreshCustomers = async () => {
    try {
      const customersRes = await getCustomerList();
      setCustomers(customersRes?.success ? (customersRes.data || []) : []);
    } catch (error) {
      console.error("Error refreshing customers:", error);
    }
  };

  const refreshShippingCompanies = async () => {
    try {
      const shippingRes = await getshipping();
      setShippingCompanies(shippingRes?.success ? (Array.isArray(shippingRes.data) ? shippingRes.data : []) : []);
    } catch (error) {
      console.error("Error refreshing shipping companies:", error);
    }
  };

  const refreshProducts = async () => {
    try {
      const productsRes = await getProductCatalog();
      setProduct(Array.isArray(productsRes) ? productsRes : []);
    } catch (error) {
      console.error("Error refreshing products:", error);
    }
  };

  const ensureSupportingDataLoaded = async () => {
    const hasProducts = products.length > 0;
    const hasCustomers = customers.length > 0;
    const hasShippingCompanies = shippingCompanies.length > 0;

    if (hasProducts && hasCustomers && hasShippingCompanies) {
      return;
    }

    if (supportingDataPromiseRef.current) {
      return supportingDataPromiseRef.current;
    }

    setIsSupportingDataLoading(true);

    supportingDataPromiseRef.current = (async () => {
      try {
        const [productsData, customersRes, shippingRes] = await Promise.all([
          hasProducts ? Promise.resolve(products) : getProductCatalog(),
          hasCustomers ? Promise.resolve({ success: true, data: customers }) : getCustomerList(),
          hasShippingCompanies ? Promise.resolve({ success: true, data: shippingCompanies }) : getshipping(),
        ]);

        if (!hasProducts) {
          setProduct(Array.isArray(productsData) ? productsData : []);
        }

        if (!hasCustomers) {
          setCustomers(customersRes?.success ? (customersRes.data || []) : []);
        }

        if (!hasShippingCompanies) {
          setShippingCompanies(shippingRes?.success ? (Array.isArray(shippingRes.data) ? shippingRes.data : []) : []);
        }
      } finally {
        supportingDataPromiseRef.current = null;
        setIsSupportingDataLoading(false);
      }
    })();

    return supportingDataPromiseRef.current;
  };

  React.useEffect(() => {
    loadData();
  }, []);

  React.useEffect(() => {
    refreshShippingCompanies();
  }, []);

  return {
    products,
    setProduct,
    customers,
    setCustomers,
    orders,
    setOrders,
    shippingCompanies,
    setShippingCompanies,
    isLoading,
    isSupportingDataLoading,
    loadData,
    loadOrdersByCustomer,
    refreshOrders,
    refreshCustomers,
    refreshShippingCompanies,
    refreshProducts,
    ensureSupportingDataLoaded,
  };
};
