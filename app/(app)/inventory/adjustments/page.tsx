export default function AdjustmentsPage() {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-5 py-[60px] text-center shadow-[var(--shadow-sm)]">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-weak text-[26px]">
        🧾
      </div>
      <div className="mb-1.5 text-[16px] font-bold">No adjustments this period</div>
      <div className="mx-auto mb-4.5 max-w-[340px] text-[13.5px] text-text-2">
        Stock adjustments for damage, loss, or recounts will appear here with a full audit trail.
      </div>
      <button className="h-[37px] rounded-[9px] bg-accent px-4 text-[13px] font-semibold text-white">
        Create adjustment
      </button>
    </div>
  );
}
