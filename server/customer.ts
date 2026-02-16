"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { success } from "zod";

export async function getCustomer() {
  const res = await prisma.customer.findMany({
    orderBy:{
      name:"desc"
    },
    include:{
      users:true,
      orders:{
        include:{
          items:{
            include:{
              product:true
            }
          }
        }
      },
      message:{
        include:{
          user:true
        }
      }
    }
    
  })
revalidatePath("/customers");
  return {success:true , data:res }
  
}

export async function AssignUsers(customerId: string, userIds: string[]) {
  try {
    const assign = await prisma.customer.update({
      where: { 
        id: customerId 
      },
      data: {
        users: {
          // 'set' تقوم بإزالة الروابط القديمة ووضع القائمة الجديدة المرسلة
          // نمرر مصفوفة من الكائنات تحتوي على المعرفات [{id: '1'}, {id: '2'}]
          set: userIds.map((id) => ({ id })),
        },
      },
      include: {
        users: true, // لإرجاع البيانات الجديدة بعد التحديث
      },
    });
    
    return {success:true , data:assign};
  } catch (error) {
    console.error("Prisma Error:", error);
    throw new Error("فشل في ربط الموظفين بالعميل");
  }
}

export async function createmessage(msg: string, customerId: string, userId: string) {
  try {
    // نستخدم $transaction لضمان سلامة البيانات
    const result = await prisma.$transaction(async (tx) => {
      
      // نتحقق إذا كان هذا أول رسالة للعميل
      const messageCount = await tx.message.count({
        where: { customerId }
      });

      // إذا كانت هناك رسائل سابقة، نقوم بتحديث الحالة
      if (messageCount === 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { status: "جاري المتابعة" }
        });
      }

      // إنشاء الرسالة الجديدة
      const newMessage = await tx.message.create({
        data: {
          message: msg,
          customerId,
          userId
        }
      });

      return newMessage;
    });

    return { success: true, data: result };

  } catch (error) {
    console.error("Error creating message:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" 
    };
  }
}

export async function createCustomerAction(data: any, id: string) {
  try {
    // 1. التحقق يدويًا إذا كان الرقم موجودًا مسبقًا في أي مصفوفة
    // نستخدم عامل البحث hasAny أو has لتفقد المصفوفات
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        phone: {
          hasSome: data.phone // يبحث إذا كان أي رقم في المصفوفة المرسلة موجود مسبقاً
        }
      }
    });

    if (existingCustomer) {
      return { success: false, error: "عذراً، رقم الهاتف هذا مسجل لعميل آخر بالفعل" };
    }

    // 2. إذا لم يكن موجوداً، نقوم بالإضافة
    const newCustomer = await prisma.customer.create({
      data: {
        name: data.name,
        status: "فرصة جديدة",
        phonestatus: "معلق",
        phone: data.phone, // مصفوفة مثل ["05xxxx"]
        countryCode: data.countryCode,
        city: data.city,
        age: data.age,
        gender: data.gender,
        rating: data.rating,
        source: data.source,
        country: data.country,
        users: {
          connect: { id: id }
        },
      },
    });

    revalidatePath("/customers");
    return { success: true, data: newCustomer };

  } catch (error: any) {
    console.error("Prisma Error:", error);
    return { success: false, error: "حدث خطأ أثناء حفظ البيانات" };
  }
}

export async function updateCustomer(data:any , customer:any) {
  try {
    const res = await prisma.customer.update({
    where:{
      id:customer
    },
    data:{
      name: data.name,
        phone: data.phone, // مصفوفة مثل ["05xxxx"]
        countryCode: data.countryCode,
        country: data.country,
        city: data.city,
        age: data.age,
        gender: data.gender,
        source: data.source,
        rating: data.rating,
    }
  })

  return {success:true , data:res}
  } catch (error) {
    return {success:false , error:error}
  }

}

export async function UpdateStusa(customer:any , status:any) {
  const stusas = await prisma.customer.update({
    where:{
      id:customer
    },
    data:{
      status:status
    }
  })

  return {success:true , data:stusas}
}

export async function deleteCustomer(data: any) {
  try {
    // 1. تحقق أولاً مما إذا كان لدى العميل أي طلبات
    const customerWithOrders = await prisma.customer.findUnique({
      where: { id: data.id },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    if (!customerWithOrders) {
      return { success: false, message: "العميل غير موجود" };
    }

    // 2. إذا كان عدد الطلبات أكبر من صفر، امنع الحذف
    if (customerWithOrders._count.orders > 0) {
      return { 
        success: false, 
        message: "لا يمكن حذف العميل لوجود طلبات مرتبطة به. يجب حذف الطلبات أولاً." 
      };
    }

    // 3. إذا لم توجد طلبات، قم بعملية الحذف
    // نستخدم transaction للتأكد من فك الارتباطات الأخرى (مثل الرسائل والمستخدمين) قبل الحذف النهائي
    const res = await prisma.$transaction(async (tx) => {
      // فك ارتباط العميل بالمستخدمين (Many-to-Many)
      await tx.customer.update({
        where: { id: data.id },
        data: {
          users: { set: [] },
          message: { deleteMany: {} } // حذف الرسائل المرتبطة إن وجدت
        }
      });

      // الحذف النهائي للعميل
      return await tx.customer.delete({
        where: { id: data.id }
      });
    });

    return { success: true, data: res };

  } catch (error) {
    console.error("Error during deletion:", error);
    return { success: false, error: "حدث خطأ أثناء محاولة الحذف" };
  }
}