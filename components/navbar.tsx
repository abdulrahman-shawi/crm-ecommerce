"use client";
// components/Navbar.tsx

import { useState, useEffect } from "react";
import { Menu, Bell, UserCircle, Clock, Save } from "lucide-react"; // أضفنا أيقونة الساعة
import { ThemeToggle } from "./ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { AppModal } from "@/components/ui/app-modal";
import toast from "react-hot-toast";

export const Navbar = ({ onMenuClick }: { onMenuClick: () => void }) => {

  const [time, setTime] = useState(new Date());

  const { user, refreshUser, isImpersonating, stopImpersonation } = useAuth();
    /**
     * Returns current tab to admin identity when impersonation mode is active.
     */
    const handleBackToAdmin = () => {
      stopImpersonation();
    };

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileJobTitle, setProfileJobTitle] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  // تحديث الوقت كل ثانية
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfileName(user.username || "");
    setProfileEmail(user.email || "");
    setProfilePhone(user.phone || "");
    setProfileJobTitle(user.jobTitle || "");
    setProfileAvatarPreview(user.avatar || null);
    setProfileAvatarFile(null);
  }, [user, isProfileOpen]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    setProfileAvatarFile(file);
    setProfileAvatarPreview(URL.createObjectURL(file));
    event.target.value = "";
  };

  const handleProfileSave = async () => {
    if (!profileName.trim() || !profileEmail.trim()) {
      toast.error("الاسم والبريد مطلوبان");
      return;
    }

    setIsSavingProfile(true);
    const loadingToast = toast.loading("جار حفظ بيانات المستخدم...");

    try {
      const formData = new FormData();
      formData.append("username", profileName.trim());
      formData.append("email", profileEmail.trim());
      formData.append("phone", profilePhone.trim());
      formData.append("jobTitle", profileJobTitle.trim());
      if (profileAvatarFile) {
        formData.append("avatar", profileAvatarFile);
      }

      const response = await fetch("/api/users/profile", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "فشل تحديث البيانات");
      }

      toast.success("تم تحديث بيانات المستخدم");
      await refreshUser();
      setIsProfileOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "تعذر حفظ البيانات");
    } finally {
      toast.dismiss(loadingToast);
      setIsSavingProfile(false);
    }
  };

  // تنسيق الوقت (ساعة:دقيقة:ثانية)
  const formattedTime = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <header className="h-16 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
      <div className="flex items-center gap-4">
        <ThemeToggle />
        
        <button 
          onClick={onMenuClick}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg md:hidden text-slate-600 dark:text-slate-300 transition-colors"
        >
          <Menu size={24} />
        </button>

        {/* الساعة الديناميكية */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <Clock size={16} className="text-blue-600 dark:text-blue-400 animate-pulse" />
          <div className="w-[100px]"> {/* عرض ثابت لمنع اهتزاز العناصر عند تغيير الأرقام */}
            <AnimatePresence mode="wait">
              <motion.span
                key={formattedTime}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums"
              >
                {formattedTime}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {isImpersonating && (
          <button
            type="button"
            onClick={handleBackToAdmin}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
            title="الرجوع لحساب الأدمن"
          >
            الرجوع لحساب الأدمن
          </button>
        )}

        <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white dark:border-slate-950"></span>
        </button>
        
        <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block"></div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-left">
            <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{user?.username}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 text-left">{user?.accountType}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="p-1 bg-slate-100 dark:bg-slate-800 rounded-full hover:ring-2 hover:ring-blue-500/40 transition-all"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username || "avatar"}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <UserCircle size={28} className="text-slate-500 dark:text-slate-400" />
            )}
          </button>
        </div>
      </div>

      <AppModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="تعديل بيانات المستخدم"
        size="md"
        footer={
          <div className="flex items-center gap-3">
            <button
              onClick={handleProfileSave}
              disabled={isSavingProfile}
              className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={16} /> حفظ
            </button>
            <button
              onClick={() => setIsProfileOpen(false)}
              className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              {profileAvatarPreview ? (
                <img
                  src={profileAvatarPreview}
                  alt="profile preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle size={36} className="text-slate-400" />
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500">الصورة الشخصية</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="block text-xs mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">اسم المستخدم</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">البريد الإلكتروني</label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">رقم الهاتف</label>
              <input
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">المسمى الوظيفي</label>
              <input
                type="text"
                value={profileJobTitle}
                onChange={(e) => setProfileJobTitle(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 outline-none"
              />
            </div>
          </div>
        </div>
      </AppModal>
    </header>
  );
};