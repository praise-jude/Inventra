"use client";

import { useState } from "react";
import { Mail, MessageCircle, Copy, Check } from "lucide-react";
import { useToast } from "@/components/app/ToastProvider";

const CONTACTS = [
  {
    id: "email",
    icon: Mail,
    label: "Email",
    value: "royalmandigitalconcept@gmail.com",
  },
  {
    id: "whatsapp",
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+234 803 630 5562",
  },
] as const;

export function SupportClient() {
  const flash = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    flash("Copied to clipboard");
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <div className="text-[22px] font-bold tracking-tight">Contact support</div>
        <div className="mt-[3px] text-text-2">Reach us directly — we usually reply within a few hours.</div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CONTACTS.map((contact) => {
          const Icon = contact.icon;
          const copied = copiedId === contact.id;
          return (
            <div key={contact.id} className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
              <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-weak text-accent-text">
                <Icon size={20} strokeWidth={2} />
              </div>
              <div className="mb-1 text-[13px] font-bold text-text-2">{contact.label}</div>
              <div className="mb-3.5 break-all font-mono text-[14px] font-semibold text-text">{contact.value}</div>
              <button
                type="button"
                onClick={() => handleCopy(contact.id, contact.value)}
                className="flex h-9 items-center gap-1.5 rounded-[9px] border border-border bg-surface px-3 text-[12.5px] font-semibold text-text hover:bg-hover"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : `Copy ${contact.label.toLowerCase()}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
