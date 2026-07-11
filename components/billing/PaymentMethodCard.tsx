"use client";

import { Button } from "@/components/ui/Button";

interface Props {
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: string | null;
  cardExpYear: string | null;
  busy: boolean;
  onUpdate: () => void;
  onRemove: () => void;
}

export function PaymentMethodCard({ cardBrand, cardLast4, cardExpMonth, cardExpYear, busy, onUpdate, onRemove }: Props) {
  const hasCard = !!cardLast4;

  return (
    <div className="flex items-center justify-between rounded-[14px] border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-accent-weak text-[16px]">💳</span>
        <div>
          {hasCard ? (
            <>
              <div className="text-[13.5px] font-semibold capitalize">
                {cardBrand ?? "Card"} •••• {cardLast4}
              </div>
              <div className="text-[11.5px] text-muted">
                Expires {cardExpMonth}/{cardExpYear}
              </div>
            </>
          ) : (
            <>
              <div className="text-[13.5px] font-semibold">No payment method on file</div>
              <div className="text-[11.5px] text-muted">Add a card to activate or continue billing</div>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onUpdate} className="h-[34px] px-3 text-[12.5px]">
          {hasCard ? "Update card" : "Add card"}
        </Button>
        {hasCard && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="h-[34px] cursor-pointer rounded-[9px] border-none bg-transparent px-3 text-[12.5px] font-semibold text-red hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
