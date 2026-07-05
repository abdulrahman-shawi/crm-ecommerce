'use client';

import React, { useState, ChangeEvent, useEffect } from 'react';
import { X, UploadCloud, FileText, Film, ArrowLeft, ArrowRight } from 'lucide-react';

export interface FileItem {
  clientId?: string;
  url: string;
  type: string;
  name: string;
  rawFile?: File; 
}

interface MultiFileUploadProps {
  value?: FileItem[];
  onChange: (files: FileItem[]) => void;
  label: string;
}

const createClientId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getFileNameFromUrl = (url?: string) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return 'file';

  const lastSegment = normalizedUrl.split('/').pop() || normalizedUrl;
  return decodeURIComponent(lastSegment.split('?')[0] || 'file');
};

const normalizeFileItem = (file: FileItem): FileItem => ({
  ...file,
  clientId: file.clientId || createClientId(),
  name: String(file.name || '').trim() || getFileNameFromUrl(file.url),
});

export const MultiFileUpload = ({ value = [], onChange, label }: MultiFileUploadProps) => {
  const [files, setFiles] = useState<FileItem[]>(() => value.map(normalizeFileItem));

  useEffect(() => {
    if (JSON.stringify(value) !== JSON.stringify(files)) {
      setFiles(value.map(normalizeFileItem));
    }
  }, [value]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const newFiles: FileItem[] = Array.from(selectedFiles).map(file => ({
        clientId: createClientId(),
        url: URL.createObjectURL(file),
        type: file.type,
        name: file.name,
        rawFile: file 
      }));
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onChange(updatedFiles);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onChange(updatedFiles);
  };

  const moveFile = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= files.length) {
      return;
    }

    const updatedFiles = [...files];
    const [selectedFile] = updatedFiles.splice(index, 1);
    updatedFiles.splice(targetIndex, 0, selectedFile);
    setFiles(updatedFiles);
    onChange(updatedFiles);
  };

  return (
    <div className="space-y-4 w-full text-right" dir="rtl">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</label>
      
      <div className="relative flex items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
        <label className="flex flex-col items-center w-full h-full justify-center cursor-pointer">
          <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-1" />
          <span className="text-xs text-slate-500 dark:text-slate-400">اسحب أو انقر لرفع الصور والملفات</span>
          <input type="file" className="hidden" multiple accept="image/*,video/*,application/pdf" onChange={handleFileChange} />
        </label>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-3 p-2 border rounded-lg bg-white dark:bg-slate-950 dark:border-slate-800 justify-end">
          {files.map((file, index) => (
            <div key={file.clientId || `${file.url}-${index}`} className="relative group w-24 h-24 border dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
              {file.type.startsWith('image/') ? (
                <img src={file.url} alt="preview" className="object-cover w-full h-full" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  {file.type.startsWith('video/') ? <Film className="text-blue-500" size={24} /> : <FileText className="text-red-500" size={24} />}
                  <span className="text-[10px] dark:text-slate-300 truncate w-full text-center px-1">{file.name}</span>
                </div>
              )}
              <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => moveFile(index, 'left')}
                  disabled={index === 0}
                  className="rounded-full bg-white/90 p-1 text-slate-700 shadow disabled:cursor-not-allowed disabled:opacity-40"
                  title="نقل لليسار"
                >
                  <ArrowLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => moveFile(index, 'right')}
                  disabled={index === files.length - 1}
                  className="rounded-full bg-white/90 p-1 text-slate-700 shadow disabled:cursor-not-allowed disabled:opacity-40"
                  title="نقل لليمين"
                >
                  <ArrowRight size={12} />
                </button>
              </div>
              <button type="button" onClick={() => removeFile(index)} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 1 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">يمكنك تغيير ترتيب الصور من أزرار اليمين واليسار على كل صورة.</p>
      ) : null}
    </div>
  );
};