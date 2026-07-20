import { prisma } from "@/lib/prisma";
import { decoratePermission, getWholesalePermissionMirror } from "@/lib/wholesale-permissions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const permissions = await prisma.permission.findMany({
            include: { users: true },
            orderBy: { roleName: 'asc' }
        });
        return NextResponse.json({ success: true, data: permissions.map((permission) => decoratePermission(permission)) }, { status: 200 });
    } catch (error) {   
        return NextResponse.json({ success: false, error: "فشل في جلب الصلاحيات" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const roleName = formData.get("roleName") as string;
        const wholesalePermissions = getWholesalePermissionMirror({});
        
        const newRole = await prisma.permission.create({
            data: { 
                roleName: roleName,
                // قيم افتراضية لضمان عدم وجود undefined في الفرونت إند
                viewProducts: false, addProducts: false, editProducts: false, deleteProducts: false,
                viewReports: false, addReports: false, editReports: false, deleteReports: false,
                viewOrders: false, addOrders: false, editOrders: false, deleteOrders: false,
                viewWarranty: false, addWarranty: false, editWarranty: false, deleteWarranty: false,
                viewCustomers: false, addCustomers: false, editCustomers: false, deleteCustomers: false,
                viewWholesaleCustomers: wholesalePermissions.viewWholesaleCustomers,
                addWholesaleCustomers: wholesalePermissions.addWholesaleCustomers,
                editWholesaleCustomers: wholesalePermissions.editWholesaleCustomers,
                deleteWholesaleCustomers: wholesalePermissions.deleteWholesaleCustomers,
                viewWholesaleOrders: wholesalePermissions.viewWholesaleOrders,
                addWholesaleOrders: wholesalePermissions.addWholesaleOrders,
                editWholesaleOrders: wholesalePermissions.editWholesaleOrders,
                deleteWholesaleOrders: wholesalePermissions.deleteWholesaleOrders,
                viewEmployees: false, addEmployees: false, editEmployees: false, deleteEmployees: false,
                viewCategories: false, addCategories: false, editCategories: false, deleteCategories: false,
                viewPermissions: false, addPermissions: false, editPermissions: false, deletePermissions: false,
                viewPages: false, addPages: false, editPages: false, deletePages: false,
                viewAnalytics: false,
            }
        });
        
        // تم تغيير 'user' إلى 'data' ليتوافق مع الفرونت إند
        return NextResponse.json({ success: true, data: decoratePermission(newRole) }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: "فشل في إنشاء الدور" }, { status: 500 });
    }
}