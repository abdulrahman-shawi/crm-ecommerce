import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ExportPayload = {
  version: string;
  exportedAt: string;
  data: {
    countries: any[];
    permissions: any[];
    users: any[];
    categories: any[];
    products: any[];
    productImages: any[];
    warehouses: any[];
    productStocks: any[];
    stockMovements: any[];
    userTargets: any[];
    targetProducts: any[];
    trackingCompanies: any[];
    generalSettings: any[];
    customers: any[];
    customerUserLinks: Array<{ customerId: string; userId: string }>;
    messages: any[];
    orders: any[];
    orderItems: any[];
  };
};

const toArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

async function resetSerialSequence(tx: any, tableName: string) {
  await tx.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1), true);`
  );
}

export async function GET() {
  try {
    const [
      countries,
      permissions,
      users,
      categories,
      products,
      productImages,
      warehouses,
      productStocks,
      stockMovements,
      userTargets,
      targetProducts,
      trackingCompanies,
      generalSettings,
      customers,
      messages,
      orders,
      orderItems,
      customerLinkRows,
    ] = await Promise.all([
      prisma.country.findMany(),
      prisma.permission.findMany(),
      prisma.user.findMany(),
      prisma.category.findMany(),
      prisma.product.findMany(),
      prisma.productImage.findMany(),
      prisma.warehouse.findMany(),
      prisma.productStock.findMany(),
      prisma.stockMovement.findMany(),
      prisma.userTarget.findMany(),
      prisma.targetProduct.findMany(),
      prisma.trakingCompany.findMany(),
      prisma.generalSetting.findMany(),
      prisma.customer.findMany(),
      prisma.message.findMany(),
      prisma.order.findMany(),
      prisma.orderItem.findMany(),
      prisma.customer.findMany({
        select: {
          id: true,
          users: { select: { id: true } },
        },
      }),
    ]);

    const customerUserLinks = customerLinkRows.flatMap((row) =>
      row.users.map((user) => ({ customerId: row.id, userId: user.id }))
    );

    const payload: ExportPayload = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      data: {
        countries,
        permissions,
        users,
        categories,
        products,
        productImages,
        warehouses,
        productStocks,
        stockMovements,
        userTargets,
        targetProducts,
        trackingCompanies,
        generalSettings,
        customers,
        customerUserLinks,
        messages,
        orders,
        orderItems,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Data export failed:", error);
    return NextResponse.json({ success: false, error: "فشل في تصدير البيانات" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const replaceExisting = String(formData.get("replace") ?? "true") !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "ملف الاستيراد غير صالح" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = parsed?.data ?? parsed;

    await prisma.$transaction(async (tx) => {
      if (replaceExisting) {
        await tx.orderItem.deleteMany();
        await tx.order.deleteMany();
        await tx.message.deleteMany();
        await tx.customer.deleteMany();

        await tx.targetProduct.deleteMany();
        await tx.userTarget.deleteMany();

        await tx.stockMovement.deleteMany();
        await tx.productImage.deleteMany();
        await tx.productStock.deleteMany();

        await tx.product.deleteMany();
        await tx.category.deleteMany();

        await tx.trakingCompany.deleteMany();
        await tx.generalSetting.deleteMany();
        await tx.warehouse.deleteMany();
        await tx.country.deleteMany();

        await tx.user.deleteMany();
        await tx.permission.deleteMany();
      }

      const countries = toArray(data?.countries);
      const permissions = toArray(data?.permissions);
      const users = toArray(data?.users);
      const categories = toArray(data?.categories);
      const products = toArray(data?.products);
      const productImages = toArray(data?.productImages);
      const warehouses = toArray(data?.warehouses);
      const productStocks = toArray(data?.productStocks);
      const stockMovements = toArray(data?.stockMovements);
      const userTargets = toArray(data?.userTargets);
      const targetProducts = toArray(data?.targetProducts);
      const trackingCompanies = toArray(data?.trackingCompanies);
      const generalSettings = toArray(data?.generalSettings);
      const customers = toArray(data?.customers);
      const customerUserLinks = toArray(data?.customerUserLinks);
      const messages = toArray(data?.messages);
      const orders = toArray(data?.orders);
      const orderItems = toArray(data?.orderItems);

      if (countries.length) await tx.country.createMany({ data: countries, skipDuplicates: true });
      if (permissions.length) await tx.permission.createMany({ data: permissions, skipDuplicates: true });
      if (users.length) await tx.user.createMany({ data: users, skipDuplicates: true });

      if (categories.length) await tx.category.createMany({ data: categories, skipDuplicates: true });
      if (products.length) await tx.product.createMany({ data: products, skipDuplicates: true });
      if (productImages.length) await tx.productImage.createMany({ data: productImages, skipDuplicates: true });

      if (warehouses.length) await tx.warehouse.createMany({ data: warehouses, skipDuplicates: true });
      if (productStocks.length) await tx.productStock.createMany({ data: productStocks, skipDuplicates: true });
      if (stockMovements.length) await tx.stockMovement.createMany({ data: stockMovements, skipDuplicates: true });

      if (userTargets.length) await tx.userTarget.createMany({ data: userTargets, skipDuplicates: true });
      if (targetProducts.length) await tx.targetProduct.createMany({ data: targetProducts, skipDuplicates: true });

      if (trackingCompanies.length) await tx.trakingCompany.createMany({ data: trackingCompanies, skipDuplicates: true });
      if (generalSettings.length) await tx.generalSetting.createMany({ data: generalSettings, skipDuplicates: true });

      if (customers.length) await tx.customer.createMany({ data: customers, skipDuplicates: true });

      for (const link of customerUserLinks) {
        const customerId = String(link?.customerId || "");
        const userId = String(link?.userId || "");
        if (!customerId || !userId) continue;

        await tx.customer.update({
          where: { id: customerId },
          data: { users: { connect: { id: userId } } },
        });
      }

      if (messages.length) await tx.message.createMany({ data: messages, skipDuplicates: true });
      if (orders.length) await tx.order.createMany({ data: orders, skipDuplicates: true });
      if (orderItems.length) await tx.orderItem.createMany({ data: orderItems, skipDuplicates: true });

      await resetSerialSequence(tx, "Country");
      await resetSerialSequence(tx, "Category");
      await resetSerialSequence(tx, "Product");
      await resetSerialSequence(tx, "ProductImage");
      await resetSerialSequence(tx, "Warehouse");
      await resetSerialSequence(tx, "ProductStock");
      await resetSerialSequence(tx, "Order");
      await resetSerialSequence(tx, "OrderItem");
      await resetSerialSequence(tx, "GeneralSetting");
    });

    return NextResponse.json({ success: true, message: "تم استيراد البيانات بنجاح" });
  } catch (error) {
    console.error("Data import failed:", error);
    return NextResponse.json({ success: false, error: "فشل في استيراد البيانات" }, { status: 500 });
  }
}
