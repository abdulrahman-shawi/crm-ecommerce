"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { isAdmin } from "@/lib/utils";
import { DynamicForm } from "@/components/shared/dynamic-form";
import { DataTable } from "@/components/shared/DataTable";
import { AppModal } from "@/components/ui/app-modal";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { FormCheckbox } from "@/components/ui/formcheck";
import { MultiFileUpload, FileItem } from "@/components/ui/ImageUpload";
import {
  getHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
} from "@/server/hero-slide";
import { Plus, Edit, Trash2, Eye, EyeOff, ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { z } from "zod";

const heroSlideSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  buttonLink: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

type HeroSlideFormValues = z.infer<typeof heroSlideSchema>;

export default function HeroSlidesPage() {
  const { user } = useAuth();
  const isUserAdmin = user && isAdmin(user);

  const [isOpen, setIsOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<HeroSlideFormValues | null>(null);
  const [imageFiles, setImageFiles] = React.useState<FileItem[]>([]);
  const [slides, setSlides] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;

  const loadSlides = async () => {
    setIsLoading(true);
    try {
      const res = await getHeroSlides();
      if (res.success) {
        setSlides(res.data || []);
      } else {
        toast.error((res as any).error || "فشل في جلب السلايدرات");
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء جلب السلايدرات");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadSlides();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setEditId(null);
    setFormData(null);
    setImageFiles([]);
  };

  const handleAdd = () => {
    setEditId(null);
    setFormData({
      title: "",
      subtitle: "",
      buttonText: "",
      buttonLink: "",
      sortOrder: 0,
      isActive: true,
    });
    setImageFiles([]);
    setIsOpen(true);
  };

  const handleEdit = (slide: any) => {
    setEditId(slide.id);
    setFormData({
      title: slide.title || "",
      subtitle: slide.subtitle || "",
      buttonText: slide.buttonText || "",
      buttonLink: slide.buttonLink || "",
      sortOrder: slide.sortOrder || 0,
      isActive: slide.isActive,
    });
    setImageFiles(slide.image ? [{ url: slide.image, type: "image/*", name: "slide-image" }] : []);
    setIsOpen(true);
  };

  const handleDelete = async (slide: any) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا السلايد؟")) return;

    try {
      const res = await deleteHeroSlide(slide.id);
      if (res.success) {
        toast.success("تم حذف السلايد بنجاح");
      } else {
        toast.error((res as any).error || "فشل في حذف السلايد");
      }
    } catch (error) {
      toast.error("حدث خطأ أثناء حذف السلايد");
    } finally {
      loadSlides();
    }
  };

  const onSubmit = async (data: HeroSlideFormValues) => {
    try {
      const formData = new FormData();
      formData.append("title", data.title || "");
      formData.append("subtitle", data.subtitle || "");
      formData.append("buttonText", data.buttonText || "");
      formData.append("buttonLink", data.buttonLink || "");
      formData.append("sortOrder", String(data.sortOrder || 0));
      formData.append("isActive", data.isActive ? "true" : "false");

      const imageFile = imageFiles[0]?.rawFile;
      if (imageFile instanceof File && imageFile.size > 0) {
        formData.append("image", imageFile);
      } else if (imageFiles[0]?.url) {
        formData.append("image", imageFiles[0].url);
      }

      let res;
      if (editId) {
        res = await updateHeroSlide(editId, formData);
      } else {
        res = await createHeroSlide(formData);
      }

      if (res.success) {
        toast.success(editId ? "تم تحديث السلايد بنجاح" : "تم إنشاء السلايد بنجاح");
        handleClose();
      } else {
        toast.error((res as any).error || "فشل في حفظ السلايد");
      }
    } catch (error) {
      toast.error("حدث خطأ غير متوقع");
    } finally {
      loadSlides();
    }
  };

  if (!isUserAdmin) {
    return (
      <div className="p-4" dir="rtl">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">سلايدر الرئيسية</h1>
        <p className="mt-4 text-sm text-slate-500">لا تملك صلاحية عرض هذه الصفحة.</p>
      </div>
    );
  }

  const columns = [
    {
      header: "الصورة",
      accessor: (item: any) =>
        item.image ? (
          <img
            src={item.image}
            alt={item.title || "slide"}
            className="h-14 w-24 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
          />
        ) : (
          <div className="h-14 w-24 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <ImageIcon size={20} className="text-slate-400" />
          </div>
        ),
    },
    {
      header: "العنوان",
      accessor: (item: any) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white">{item.title || "-"}</p>
          <p className="text-xs text-slate-500">{item.subtitle || "-"}</p>
        </div>
      ),
    },
    {
      header: "الزر",
      accessor: (item: any) =>
        item.buttonText ? (
          <span className="text-sm text-blue-600">{item.buttonText}</span>
        ) : (
          "-"
        ),
    },
    {
      header: "الترتيب",
      accessor: (item: any) => <span className="text-sm">{item.sortOrder}</span>,
    },
    {
      header: "الحالة",
      accessor: (item: any) =>
        item.isActive ? (
          <div className="flex items-center gap-1 text-green-600">
            <Eye size={14} />
            <span className="text-sm">نشط</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-slate-400">
            <EyeOff size={14} />
            <span className="text-sm">معطل</span>
          </div>
        ),
    },
  ];

  const actions = [
    { label: "تعديل", icon: <Edit size={16} />, onClick: handleEdit },
    { label: "حذف", icon: <Trash2 size={16} />, onClick: handleDelete, variant: "danger" as const },
  ];

  return (
    <div className="p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">سلايدر الرئيسية</h1>
          <p className="text-sm text-slate-500 mt-1">إدارة سلايدر الصفحة الرئيسية للمتجر</p>
        </div>
        <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
          <Plus size={16} className="ml-2" />
          إضافة سلايد
        </Button>
      </div>

      <DataTable
        data={slides}
        columns={columns}
        actions={actions}
        isLoading={isLoading}
        totalCount={slides.length}
        pageSize={pageSize}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <AppModal
        title={editId ? "تعديل السلايد" : "إضافة سلايد جديد"}
        isOpen={isOpen}
        onClose={handleClose}
        size="lg"
      >
        <div className="p-2">
          <DynamicForm
            schema={heroSlideSchema}
            onSubmit={onSubmit}
            defaultValues={formData || undefined}
            submitLabel={editId ? "تحديث السلايد" : "إنشاء السلايد"}
          >
            {({ register, formState: { errors } }) => (
              <div className="grid gap-4">
                <MultiFileUpload
                  label="صورة السلايد"
                  value={imageFiles}
                  onChange={(files) => setImageFiles(files.slice(0, 1))}
                />

                <FormInput
                  label="العنوان (اختياري)"
                  placeholder="مثال: وصل حديثاً - تشكيلة الربيع"
                  {...register("title")}
                  error={errors.title?.message as string}
                />

                <FormInput
                  label="النص الفرعي (اختياري)"
                  placeholder="مثال: اكتشفي أحدث منتجات العناية بالبشرة"
                  {...register("subtitle")}
                  error={errors.subtitle?.message as string}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput
                    label="نص الزر (اختياري)"
                    placeholder="مثال: تسوّقي الآن"
                    {...register("buttonText")}
                    error={errors.buttonText?.message as string}
                  />

                  <FormInput
                    label="رابط الزر (اختياري)"
                    placeholder="/products أو رابط خارجي"
                    {...register("buttonLink")}
                    error={errors.buttonLink?.message as string}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput
                    label="الترتيب"
                    type="number"
                    min={0}
                    {...register("sortOrder")}
                    error={errors.sortOrder?.message as string}
                  />

                  <FormCheckbox
                    label="تفعيل السلايد"
                    {...register("isActive")}
                  />
                </div>
              </div>
            )}
          </DynamicForm>
        </div>
      </AppModal>
    </div>
  );
}
