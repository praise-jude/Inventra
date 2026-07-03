export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* brand panel */}
      <div
        className="authbrand relative hidden flex-1 flex-col justify-between overflow-hidden p-14 text-white"
        style={{ background: "linear-gradient(160deg,#4b45d1,#635bff 55%,#8a86ff)" }}
      >
        <div className="relative z-[2] flex items-center gap-[11px]">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-white font-extrabold text-[#4b45d1]">
            S
          </div>
          <span className="text-[17px] font-bold tracking-tight">Stockwell</span>
        </div>
        <div className="relative z-[2]">
          <div className="max-w-[440px] text-[34px] font-bold leading-[1.15] tracking-tight">
            Inventory that runs itself.
          </div>
          <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed opacity-90">
            Real-time stock, supplier orders, and profit analytics for modern retail — in one
            calm, fast workspace.
          </p>
          <div className="mt-[34px] flex gap-[26px]">
            <div>
              <div className="text-[26px] font-bold">99.98%</div>
              <div className="text-[12.5px] opacity-80">uptime</div>
            </div>
            <div>
              <div className="text-[26px] font-bold">12k+</div>
              <div className="text-[12.5px] opacity-80">stores</div>
            </div>
            <div>
              <div className="text-[26px] font-bold">$2.4B</div>
              <div className="text-[12.5px] opacity-80">tracked</div>
            </div>
          </div>
        </div>
        <div className="relative z-[2] text-[13px] opacity-75">
          Trusted by grocers, pharmacies &amp; wholesalers worldwide.
        </div>
        <div className="absolute -right-[120px] -top-20 h-[420px] w-[420px] rounded-full bg-white/10" />
        <div className="absolute bottom-[-140px] right-[60px] h-[300px] w-[300px] rounded-full bg-white/[0.08]" />
      </div>

      {/* form panel */}
      <div className="flex min-w-0 flex-1 items-center justify-center p-8">
        <div className="w-full max-w-[388px] animate-fade-up">
          <div className="mb-[34px] flex items-center gap-2.5">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-accent font-extrabold text-white">
              S
            </div>
            <span className="text-[16px] font-bold tracking-tight">Stockwell</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
