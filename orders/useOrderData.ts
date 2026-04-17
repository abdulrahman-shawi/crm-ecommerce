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

  // جلب البيانات الأساسية
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, customersRes, ordersRes, shippingRes] = await Promise.all([
        getProductCatalog(),
        getCustomerList(),
        getOrders(),
        getshipping(),
      ]);

      setProduct(Array.isArray(productsData) ? productsData : []);
      setCustomers(customersRes?.success ? (customersRes.data || []) : []);
      setOrders(ordersRes?.success ? (ordersRes.data || []) : []);
      setShippingCompanies(shippingRes?.success ? (Array.isArray(shippingRes.data) ? shippingRes.data : []) : []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
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

  // تحديث قائمة الطلبات
  const refreshOrders = async () => {
    try {
      const ordersRes = await getOrders();
      setOrders(ordersRes?.success ? (ordersRes.data || []) : []);
    } catch (error) {
      console.error("Error refreshing orders:", error);
    }
  };

  const refreshCustomers = async () => {
    try {
      const customersRes = await getCustomer();
      setCustomers(customersRes?.success ? (customersRes.data || []) : []);
    } catch (error) {
      console.error("Error refreshing customers:", error);
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

  // تحميل البيانات عند التركيب
  React.useEffect(() => {
    loadData();
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
    loadData,
    loadOrdersByCustomer,
    refreshOrders,
    refreshCustomers,
    refreshShippingCompanies,
    refreshProducts,
  };
};
