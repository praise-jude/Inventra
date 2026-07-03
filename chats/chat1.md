# Modern SaaS Inventory System

_Started 2026-07-03 17:56 UTC_

---

## User

# Build a Modern SaaS Inventory Management System

I want you to act as a senior Product Designer, UX Designer, and Senior Full-Stack SaaS Architect.

Design and build a modern, premium Inventory Management Software that real businesses would actually use.

The application should feel like a product from Stripe, Linear, Notion, Shopify, or Vercel—minimal, clean, fast, modern, and extremely intuitive.

This is not a simple CRUD inventory app.

Design something that could become a real SaaS startup.

---

## Goal

Help businesses:

* Track inventory in real time
* Reduce stock loss
* Know what products they have
* Know what products are selling
* Receive alerts before products run out
* Manage warehouses
* Manage suppliers
* Manage purchases
* Manage sales
* View reports
* Track profits
* Work with multiple staff members

Everything should feel effortless.

---

## Target Users

* Retail stores
* Supermarkets
* Fashion stores
* Pharmacies
* Electronics stores
* Restaurants
* Small businesses
* Medium businesses
* Wholesalers

---

# Branding

Use a modern SaaS aesthetic.

* Soft colors
* Rounded corners
* Beautiful spacing
* Clean typography
* Cards
* Charts
* Tables
* Elegant icons
* Smooth animations
* Responsive layout

The UI should feel premium.

---

# Authentication

Create screens for:

* Login
* Sign Up
* Forgot Password
* Verify Email
* Two-factor Authentication
* Profile
* Account Settings

---

# Dashboard

The dashboard should immediately answer:

How is my business doing today?

Include cards for:

* Total Products
* Products In Stock
* Low Stock
* Out of Stock
* Today's Sales
* Today's Revenue
* Monthly Revenue
* Monthly Profit
* Pending Purchase Orders
* Active Suppliers

Charts:

* Sales trend
* Inventory value
* Top selling products
* Revenue
* Product categories
* Monthly profit

Include recent activities.

---

# Products Module

Allow users to:

Create Product

Edit Product

Delete Product

Duplicate Product

Archive Product

Each product should include:

* Product Name
* SKU
* Barcode
* QR Code
* Description
* Category
* Brand
* Unit
* Cost Price
* Selling Price
* Tax
* Supplier
* Warehouse
* Images
* Quantity
* Reorder Level
* Expiry Date
* Batch Number
* Weight
* Dimensions

Support:

Product Variants

Example:

* Size
* Color
* Memory
* Storage

Bulk Import

Bulk Export

CSV

Excel

Barcode generation

QR generation

---

# Inventory

Track:

Current Stock

Reserved Stock

Available Stock

Damaged Stock

Returned Stock

Transferred Stock

Expired Stock

Adjustment History

Stock Movement Timeline

Every stock movement should have history.

Who changed it?

When?

Why?

---

# Warehouses

Support multiple warehouses.

Each warehouse has:

* Name
* Address
* Manager
* Capacity

Allow transferring stock between warehouses.

Show transfer status.

---

# Suppliers

Supplier Profile

Contact Details

Purchase History

Outstanding Balance

Orders

Performance

Lead Time

---

# Customers

Store:

Customer information

Purchase history

Outstanding invoices

Loyalty points

Recent purchases

---

# Purchase Orders

Create Purchase Order

Approve Purchase Order

Receive Goods

Partial Delivery

Completed

Cancelled

Print PDF

Email Supplier

---

# Sales

Create sales

Invoices

Receipts

Discounts

Taxes

Returns

Refunds

Payment Status

Payment Methods

Cash

Card

Transfer

Wallet

---

# Barcode Scanner

Include a beautiful barcode scanner screen.

Allow:

Find Product

Sell Product

Receive Product

Update Stock

---

# Notifications

Low Stock

Out of Stock

Expiring Products

New Orders

Failed Payments

Warehouse Transfers

---

# Reports

Inventory Report

Sales Report

Profit Report

Supplier Report

Warehouse Report

Product Performance

Daily

Weekly

Monthly

Yearly

Export PDF

CSV

Excel

---

# Analytics

Beautiful charts showing:

Revenue

Profit

Inventory Growth

Top Customers

Top Products

Fast-moving inventory

Slow-moving inventory

Dead stock

Forecast demand

---

# User Management

Owner

Admin

Manager

Cashier

Warehouse Staff

Different permissions for each role.

---

# Activity Log

Every action should be logged.

Who

What

When

IP Address

Device

---

# Settings

Business Information

Currency

Timezone

Tax

Email

Notifications

Invoice Template

Dark Mode

Language

Integrations

---

# Search

Global search should instantly find:

Products

Customers

Suppliers

Orders

Invoices

Warehouses

Users

---

# Filters

Powerful filtering everywhere.

Search

Date

Warehouse

Category

Supplier

Status

Price

Quantity

Tags

---

# Nice Features

Favorites

Pinned Products

Saved Filters

Keyboard Shortcuts

Bulk Actions

Undo Delete

Quick Add

Recent Products

AI Search

AI Insights

Voice Search

Drag & Drop

Command Palette (Ctrl + K)

---

# SaaS Features

Subscription Plans

Billing

Workspace

Invite Team

Organizations

Multiple Businesses

Usage Limits

Audit Logs

API Keys

Integrations

---

# Integrations

Stripe

Paystack

QuickBooks

Slack

Google Drive

Dropbox

Email

SMS

Webhook Support

---

# Mobile Experience

Responsive on:

Desktop

Tablet

Phone

Should feel like a professional SaaS application.

---

# UX Expectations

Every page should have:

Empty States

Loading States

Skeleton Screens

Success States

Error States

Confirmation Dialogs

Helpful Tooltips

Beautiful Modals

Smooth Animations

Professional Tables

Pagination

Infinite Scroll where appropriate

Sticky Table Headers

---

# Dashboard Widgets

Allow users to rearrange widgets.

Drag and drop.

Save layout.

---

# Theme

Support:

Light Mode

Dark Mode

System Theme

---

# Final Output

Generate:

* Complete application design
* Beautiful responsive layouts
* Modern component library
* Design system
* Reusable UI components
* Professional navigation
* Sidebar
* Topbar
* Tables
* Charts
* Forms
* Dialogs
* Cards
* Empty states
* Mobile views

Think like you're building the next billion-dollar inventory SaaS product. Every screen should feel polished, production-ready, and thoughtfully designed with exceptional user experience.

## Assistant

This is a huge scope — realistically I can build a polished, cohesive slice that feels like a real product rather than 50 shallow screens. Let me get a few things nailed down first so I build the right thing.

_[tool: questions_v2]_

## User

Questions answered:
- scope: Dashboard (the hero screen — cards, charts, activity), Inventory + stock movement history, Settings + user management, Auth screens (login, signup, 2FA), Products module (list, detail, add/edit, variants)
- platform: Both desktop and a mobile view
- fidelity: Fully interactive with realistic data & command palette
- vibe: Stripe — light, airy, soft indigo, refined
- theme: Both, with a toggle
- accent: 1
- industry: Supermarket/grocery
- extras: Include subscription too.

## Assistant

This is a big, exciting build. Let me set up a task list and start constructing it as one rich Design Component.

_[tool: update_todos]_

Now the main build. I'll write the logic (data + routing) and the shell + auth + dashboard first, then append the remaining screens.

_[tool: dc_write]_

## Assistant

_[tool: dc_write]_

Now let me check it renders, then append the remaining route screens (products, inventory, team, billing, settings).

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: get_webview_logs]_

_[tool: show_html]_

Login looks great. The brand panel is hidden pending responsive CSS. Now let me add the remaining screens. First, extend the logic with data + handlers.

_[tool: dc_js_str_replace]_

Now add the new route flags, data, and handlers to the returned object.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the Products screen with table, detail slide-over, and add-product modal.

_[tool: dc_html_str_replace]_

Now Inventory, Team, Billing, Settings screens.

_[tool: dc_html_str_replace]_

Now add all the computed data these screens reference.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the product detail slide-over and add-product modal. I'll add them near the command palette (fixed overlays inside the app sc-if).

_[tool: dc_html_str_replace]_

Now the product-detail data (facts, variants, barcode bars).

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now add responsive CSS to the helmet so the auth brand panel shows on wide screens and the layout adapts on mobile.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: grep]_

_[tool: sleep]_

_[tool: save_screenshot]_

Login with brand panel looks polished. Now let me sign in and check the dashboard + charts.

_[tool: save_screenshot]_

Dashboard looks great. Let me check the charts render by scrolling down.

_[tool: save_screenshot]_

_[tool: save_screenshot]_

Charts render beautifully. Let me quickly verify Products (table + detail slide-over) and Inventory work, then dark mode.

_[tool: multi_screenshot]_

Everything works — products table, detail slide-over, inventory, billing. Let me verify dark mode.

_[tool: save_screenshot]_

Dark mode adapts perfectly — charts included. The full app is working. Handing off.

_[tool: update_todos]_

## Assistant

## Assistant

_[tool: ready_for_verification]_

**Stockwell** — a premium, fully-interactive inventory SaaS in the Stripe aesthetic (soft indigo, airy, refined) with light/dark toggle. Built as one streaming Design Component.

What's in it:
- **Auth**: login (with brand panel), signup, forgot-password, 2FA — sign in enters the app.
- **Dashboard**: 6 KPI cards, revenue/profit area chart, category-mix donut, top sellers, stock health, live activity feed.
- **Products**: searchable/filterable table → click any row for a slide-over with barcode + QR, margins, key facts, and variants; plus a full "New product" modal.
- **Inventory**: stock-type cards (reserved/available/damaged/expiring), movement history table with audit trail, by-warehouse view.
- **Team**: members, role badges, permission legend. **Billing**: current-usage banner, 3-tier plans, invoice history. **Settings**: business info, appearance, notification toggles, integrations.
- **Command palette (⌘K)**, toast confirmations, responsive mobile layout (off-canvas sidebar), and grocery/supermarket sample data throughout.

Everything is grocery-anchored (FreshMart Co.) and the charts adapt to dark mode automatically. Try **⌘K**, toggle the theme (top bar), and click product rows.

Next steps if you want them: Sales/POS + invoices, purchase orders + suppliers, or a dedicated barcode-scanner screen — just say which.

