import React from 'react';
import { AppModal } from '@/components/ui/app-modal';
import { Button } from '@/components/ui/button';

interface ShippingForm {
  shippingCompanyName: string;
  shippingPrice: string;
  moneyTransferCommission: string;
  otherCommissions: string;
}

interface ShippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shippingForm: ShippingForm;
  onFormChange: (form: ShippingForm) => void;
  shippingCompanyOptions: string[];
  onSave: () => Promise<void>;
  isSaving: boolean;
  targetOrder?: any;
}

export const ShippingModal: React.FC<ShippingModalProps> = ({
  isOpen,
  onClose,
  shippingForm,
  onFormChange,
  shippingCompanyOptions,
  onSave,
  isSaving,
  targetOrder,
}) => {
  return (
    <AppModal
      size="md"
      isOpen={isOpen}
      onClose={onClose}
      title="بيانات الشحن والعمولات"
      description={targetOrder ? `الطلب #${targetOrder.orderNumber}` : undefined}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        {/* اسم شركة الشحن */}
        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">
            اسم شركة الشحن
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2"
            value={shippingForm.shippingCompanyName}
            onChange={(e) =>
              onFormChange({ ...shippingForm, shippingCompanyName: e.target.value })
            }
            disabled={isSaving}
          >
            <option value="">اختر شركة الشحن</option>
            {shippingCompanyOptions.map((name: string) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* سعر الشحنة */}
        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">
            سعر الشحنة
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
            value={shippingForm.shippingPrice}
            onChange={(e) =>
              onFormChange({ ...shippingForm, shippingPrice: e.target.value })
            }
            disabled={isSaving}
          />
        </div>

        {/* عمولة تحويل الأموال */}
        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">
            عمولة تحويل الأموال
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
            value={shippingForm.moneyTransferCommission}
            onChange={(e) =>
              onFormChange({
                ...shippingForm,
                moneyTransferCommission: e.target.value,
              })
            }
            disabled={isSaving}
          />
        </div>

        {/* عمولات أخرى */}
        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200">
            عمولات أخرى
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
            value={shippingForm.otherCommissions}
            onChange={(e) =>
              onFormChange({ ...shippingForm, otherCommissions: e.target.value })
            }
            disabled={isSaving}
          />
        </div>
      </div>
    </AppModal>
  );
};
