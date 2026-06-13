"use client";

import React from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";
import {
  Heading1,
  Heading3,
  Type,
  List,
  ListOrdered,
  Bold,
  Italic,
  Strikethrough,
} from "lucide-react";

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const ToolbarButton = ({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={cn(
      "p-2 rounded-md transition-colors border border-transparent",
      "hover:bg-slate-100 dark:hover:bg-slate-800",
      active
        ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
        : "text-slate-600 dark:text-slate-400"
    )}
  >
    {children}
  </button>
);

const EditorToolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
      <ToolbarButton
        title="عنوان رئيسي"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={18} />
      </ToolbarButton>

      <ToolbarButton
        title="عنوان فرعي"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={18} />
      </ToolbarButton>

      <ToolbarButton
        title="فقرة"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Type size={18} />
      </ToolbarButton>

      <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

      <ToolbarButton
        title="قائمة نقطية"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={18} />
      </ToolbarButton>

      <ToolbarButton
        title="قائمة مرقمة"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={18} />
      </ToolbarButton>

      <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

      <ToolbarButton
        title="عريض"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={18} />
      </ToolbarButton>

      <ToolbarButton
        title="مائل"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={18} />
      </ToolbarButton>

      <ToolbarButton
        title="مشطوب"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={18} />
      </ToolbarButton>
    </div>
  );
};

export const RichTextEditor = React.forwardRef<HTMLDivElement, RichTextEditorProps>(
  (
    {
      value = "",
      onChange,
      label,
      error,
      placeholder = "اكتب الوصف هنا...",
      className,
      disabled,
    },
    ref
  ) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass:
            "is-editor-empty before:content-[attr(data-placeholder)] before:float-right before:text-slate-400 before:pointer-events-none before:h-0",
        }),
      ],
      content: value,
      editable: !disabled,
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML());
      },
    });

    React.useEffect(() => {
      if (editor && editor.getHTML() !== value) {
        editor.commands.setContent(value, { emitUpdate: false });
      }
    }, [value, editor]);

    return (
      <div className={cn("flex flex-col gap-1.5 w-full text-right", className)} ref={ref}>
        {label && (
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <div
          className={cn(
            "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 overflow-hidden transition-all",
            error && "border-red-500",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          <EditorToolbar editor={editor} />
          <EditorContent
            editor={editor}
            dir="rtl"
            className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-[160px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-right [&_.ProseMirror]:text-slate-800 [&_.ProseMirror]:dark:text-slate-200 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pr-4 [&_ol]:pr-4"
          />
        </div>
        {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
