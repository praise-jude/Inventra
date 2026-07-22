"use client";

import {
  Boxes,
  ScanBarcode,
  Barcode,
  ArrowLeftRight,
  Warehouse,
  Users,
  BookUser,
  FileText,
  Receipt,
  LineChart,
  BarChart3,
  WifiOff,
  CloudUpload,
  ShieldCheck,
  Building2,
  Gauge,
  BellRing,
  Smartphone,
  Lock,
  Search,
  Download,
  Sparkles,
} from "lucide-react";
import { MotionStagger, fadeUpItem } from "./MotionSection";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: Boxes, title: "Inventory Management", desc: "Track stock levels, variants, and product catalogs in real time." },
  { icon: ScanBarcode, title: "POS System", desc: "Ring up sales fast with a POS built for speed and offline reliability." },
  { icon: Barcode, title: "Barcode Generator", desc: "Generate and print barcodes for every product in seconds." },
  { icon: ArrowLeftRight, title: "Stock Transfer", desc: "Move inventory between branches and warehouses with full audit trails." },
  { icon: Warehouse, title: "Warehouse Management", desc: "Manage multiple warehouses and locations from a single view." },
  { icon: Users, title: "Customer Management", desc: "Keep customer profiles, purchase history, and contact info organized." },
  { icon: BookUser, title: "Debt Book", desc: "Track credit sales and outstanding balances without spreadsheets." },
  { icon: FileText, title: "Invoices", desc: "Create and send professional invoices in a couple of clicks." },
  { icon: Receipt, title: "Expenses", desc: "Log business expenses and see exactly where your money goes." },
  { icon: LineChart, title: "Profit Analytics", desc: "Understand margins and profitability by product, branch, or period." },
  { icon: BarChart3, title: "Business Reports", desc: "Generate detailed reports for sales, stock, and performance." },
  { icon: WifiOff, title: "Offline Sync", desc: "Keep selling even without internet — data syncs when you're back online." },
  { icon: CloudUpload, title: "Cloud Sync", desc: "Your data is always backed up and accessible from anywhere." },
  { icon: ShieldCheck, title: "Role-Based Access", desc: "Give staff exactly the permissions they need, nothing more." },
  { icon: Building2, title: "Multi-Branch", desc: "Run and compare multiple store locations from one account." },
  { icon: Gauge, title: "Real-Time Dashboard", desc: "See sales, stock, and cash flow update live as it happens." },
  { icon: BellRing, title: "Low Stock Alerts", desc: "Get notified before you run out of your best-selling items." },
  { icon: Smartphone, title: "Mobile App", desc: "Manage your business on the go with the Inventra mobile app." },
  { icon: Lock, title: "Secure Authentication", desc: "MFA, encrypted sessions, and enterprise-grade account security." },
  { icon: Search, title: "Fast Search", desc: "Find any product, sale, or customer instantly, typo-tolerant search included." },
  { icon: Download, title: "Export Reports", desc: "Export to Excel, CSV, or PDF whenever you need offline records." },
  { icon: Sparkles, title: "AI Insights", desc: "Smart reorder suggestions and forecasts built right into your dashboard." },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[32px] font-extrabold tracking-tight text-text sm:text-[40px]">
          Everything your business needs
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-text-2">
          One platform to manage inventory, sales, customers, and operations — built for
          businesses that move fast.
        </p>
      </div>

      <MotionStagger className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <motion.div
            key={title}
            variants={fadeUpItem}
            className="group rounded-2xl border border-border bg-surface p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[var(--shadow)]"
          >
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
              style={{ background: "var(--accent-weak)", color: "var(--accent-text)" }}
            >
              <Icon size={20} />
            </span>
            <h3 className="mt-4 text-[15.5px] font-bold text-text">{title}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-2">{desc}</p>
          </motion.div>
        ))}
      </MotionStagger>
    </section>
  );
}
