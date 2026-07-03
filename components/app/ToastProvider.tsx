"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  return (
    <ToastContext.Provider value={flash}>
      {children}
      {toast && (
        <div className="animate-fade-up fixed bottom-[22px] left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2.5 rounded-[11px] bg-text px-[18px] py-[11px] text-[13.5px] font-semibold text-bg shadow-[var(--shadow-lg)]">
          <span className="text-green">✓</span>
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
}
