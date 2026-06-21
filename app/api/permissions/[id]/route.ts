import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// تعريف الواجهة لبيانات الـ Params
interface RouteParams {
  params: { id: string };
}

// دالة التحديث PUT
export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
        const data = await req.json();
        const { id } = params; 

        const updatedPermission = await prisma.permission.update({
            where: { id: id },
            data: {
                roleName: data.roleName,
                
                // المنتجات
                viewProducts: Boolean(data.viewProducts),
                addProducts: Boolean(data.addProducts),
                editProducts: Boolean(data.editProducts),
                deleteProducts: Boolean(data.deleteProducts),
                
                // التقارير
                viewReports: Boolean(data.viewReports),
                addReports: Boolean(data.addReports),
                editReports: Boolean(data.editReports),
                deleteReports: Boolean(data.deleteReports),
                
                // الطلبات
                viewOrders: Boolean(data.viewOrders),
                addOrders: Boolean(data.addOrders),
                editOrders: Boolean(data.editOrders),
                deleteOrders: Boolean(data.deleteOrders),

                // الكفالة
                viewWarranty: Boolean(data.viewWarranty),
                addWarranty: Boolean(data.addWarranty),
                editWarranty: Boolean(data.editWarranty),
                deleteWarranty: Boolean(data.deleteWarranty),

                // العملاء
                viewCustomers: Boolean(data.viewCustomers),
                addCustomers: Boolean(data.addCustomers),
                editCustomers: Boolean(data.editCustomers),
                deleteCustomers: Boolean(data.deleteCustomers),

                // الموظفين
                viewEmployees: Boolean(data.viewEmployees),
                addEmployees: Boolean(data.addEmployees),
                editEmployees: Boolean(data.editEmployees),
                deleteEmployees: Boolean(data.deleteEmployees),

                // المصاريف
                viewExpenses: Boolean(data.viewExpenses),
                addExpenses: Boolean(data.addExpenses),
                editExpenses: Boolean(data.editExpenses),
                deleteExpenses: Boolean(data.deleteExpenses),

                // تصنيف المنتجات
                viewCategories: Boolean(data.viewCategories),
                addCategories: Boolean(data.addCategories),
                editCategories: Boolean(data.editCategories),
                deleteCategories: Boolean(data.deleteCategories),

                // الصلاحيات
                viewPermissions: Boolean(data.viewPermissions),
                addPermissions: Boolean(data.addPermissions),
                editPermissions: Boolean(data.editPermissions),
                deletePermissions: Boolean(data.deletePermissions),
                accessSyria: Boolean(data.accessSyria),
                accessTurkey: Boolean(data.accessTurkey),

                // إحصائيات النظام (حقل واحد فقط)
                viewAnalytics: Boolean(data.viewAnalytics),
            }
        });

        return NextResponse.json({ success: true, data: updatedPermission });
    } catch (error) {
        console.error("Update Error:", error);
        return NextResponse.json({ success: false, error: "فشل تحديث البيانات" }, { status: 500 });
    }
}

// دالة الحذف DELETE (تم إصلاحها هنا)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = params; // الوصول المباشر للمععرف id

        const deletedPermission = await prisma.permission.delete({
            where: { id: id },
        });

        return NextResponse.json({ success: true, data: deletedPermission });
    } catch (error) {
        console.error("Delete Error:", error);
        return NextResponse.json({ 
            success: false, 
            error: "فشل الحذف، قد يكون الدور مرتبطاً بمستخدمين حاليين" 
        }, { status: 500 });
    }
}