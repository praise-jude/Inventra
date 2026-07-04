"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/app/ToastProvider";
import { createCategory, updateCategory } from "@/lib/actions/categories";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

interface Props {
  category?: { id: string; name: string; emoji: string | null };
  onClose: () => void;
}

export function CategoryModal({ category, onClose }: Props) {
  const router = useRouter();
  const flash = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (category) {
        await updateCategory(category.id, { name, emoji });
        flash("Category updated");
      } else {
        await createCategory({ name, emoji });
        flash("Category created");
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(15,20,32,.45)] p-6 backdrop-blur-sm"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="animate-scale-in w-full max-w-[420px] rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
          <div className="text-[16px] font-bold">{category ? "Edit category" : "New category"}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-[8px] border border-border bg-surface text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-[22px] py-5">
          <div className="flex gap-3">
            <div className="w-[70px]">
              <Field label="Icon" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} className="text-center text-[18px]" />
            </div>
            <div className="flex-1">
              <Field label="Category name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          {error && <p className="text-[13px] font-medium text-red">{error}</p>}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-[22px] py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : category ? "Save changes" : "Create category"}
          </Button>
        </div>
      </form>
    </div>
  );
}
