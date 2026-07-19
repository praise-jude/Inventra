"use client";

import { useState, useTransition } from "react";
import { updateRolePermission, resetRolePermission } from "@/lib/actions/roles";

export type CustomizableRole = "manager" | "cashier" | "warehouse";

export interface RoleMatrixCell {
  role: CustomizableRole;
  value: boolean;
  isOverride: boolean;
}

export interface RoleMatrixAction {
  action: string;
  label: string;
  cells: RoleMatrixCell[];
}

export interface RoleMatrixModule {
  module: string;
  label: string;
  actions: RoleMatrixAction[];
}

const ROLE_LABELS: Record<CustomizableRole, string> = {
  manager: "Manager",
  cashier: "Cashier",
  warehouse: "Warehouse",
};

const CUSTOMIZABLE_ROLES: CustomizableRole[] = ["manager", "cashier", "warehouse"];

interface CellState {
  value: boolean;
  isOverride: boolean;
  pending: boolean;
}

function cellKey(role: string, module: string, action: string) {
  return `${role}:${module}:${action}`;
}

export function RolesClient({ modules }: { modules: RoleMatrixModule[] }) {
  const [, startTransition] = useTransition();
  const [state, setState] = useState<Record<string, CellState>>(() => {
    const initial: Record<string, CellState> = {};
    for (const mod of modules) {
      for (const act of mod.actions) {
        for (const cell of act.cells) {
          initial[cellKey(cell.role, mod.module, act.action)] = {
            value: cell.value,
            isOverride: cell.isOverride,
            pending: false,
          };
        }
      }
    }
    return initial;
  });

  function toggle(role: CustomizableRole, module: string, action: string) {
    const key = cellKey(role, module, action);
    const current = state[key];
    const next = !current.value;
    setState((s) => ({ ...s, [key]: { ...s[key], value: next, isOverride: true, pending: true } }));
    startTransition(async () => {
      try {
        await updateRolePermission(role, module, action, next);
      } catch {
        setState((s) => ({ ...s, [key]: { ...current, pending: false } }));
        return;
      }
      setState((s) => ({ ...s, [key]: { ...s[key], pending: false } }));
    });
  }

  function reset(role: CustomizableRole, module: string, action: string, defaultValue: boolean) {
    const key = cellKey(role, module, action);
    const previous = state[key];
    setState((s) => ({ ...s, [key]: { value: defaultValue, isOverride: false, pending: true } }));
    startTransition(async () => {
      try {
        await resetRolePermission(role, module, action);
      } catch {
        setState((s) => ({ ...s, [key]: previous }));
        return;
      }
      setState((s) => ({ ...s, [key]: { ...s[key], pending: false } }));
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-sm)]">
      <div className="border-b border-border-2 px-5 py-4">
        <div className="text-[13.5px] font-semibold">Owner &amp; Admin</div>
        <div className="mt-0.5 text-[12px] text-muted">Always have full access — this can&apos;t be changed.</div>
      </div>

      {modules.map((mod, modIdx) => (
        <div key={mod.module} style={{ borderBottom: modIdx < modules.length - 1 ? "1px solid var(--border-2)" : "none" }}>
          <div className="grid grid-cols-[1fr_repeat(3,84px)] items-center gap-2 px-5 pt-4 pb-2">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-muted">{mod.label}</div>
            {CUSTOMIZABLE_ROLES.map((role) => (
              <div key={role} className="text-center text-[11px] font-semibold text-muted">
                {ROLE_LABELS[role]}
              </div>
            ))}
          </div>

          {mod.actions.map((act) => (
            <div key={act.action} className="grid grid-cols-[1fr_repeat(3,84px)] items-center gap-2 px-5 py-2.5">
              <div className="text-[13px]">{act.label}</div>
              {CUSTOMIZABLE_ROLES.map((role) => {
                const key = cellKey(role, mod.module, act.action);
                const cell = state[key];
                if (!cell) return <div key={role} />;
                return (
                  <div key={role} className="flex flex-col items-center gap-0.5">
                    <div
                      onClick={() => !cell.pending && toggle(role, mod.module, act.action)}
                      className="relative h-[23px] w-10 flex-shrink-0 cursor-pointer rounded-[20px] transition-colors"
                      style={{ background: cell.value ? "var(--accent)" : "var(--border)", opacity: cell.pending ? 0.6 : 1 }}
                    >
                      <div
                        className="absolute top-[2.5px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all"
                        style={{ left: cell.value ? "19px" : "2.5px" }}
                      />
                    </div>
                    {cell.isOverride ? (
                      <button
                        type="button"
                        disabled={cell.pending}
                        onClick={() => reset(role, mod.module, act.action, defaultFor(mod.module, act.action, role))}
                        className="text-[10px] text-muted underline decoration-dotted hover:text-accent"
                      >
                        Reset
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted opacity-0">Reset</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// The reset action's optimistic value must match has_permission()'s
// fallback exactly — mirrors DEFAULT_PERMISSIONS in lib/permissions.ts.
// Duplicated here (rather than imported) because lib/permissions.ts is
// server-only and this is a client component.
const DEFAULTS: Record<CustomizableRole, Record<string, Record<string, boolean>>> = {
  manager: {
    inventory: { create: true, edit: true, delete: true, create_movement: true, delete_movement: true },
    sales: { create: true, edit: true, delete: true },
    reports: { view: true },
  },
  cashier: {
    inventory: { create: false, edit: false, delete: false, create_movement: true, delete_movement: false },
    sales: { create: true, edit: false, delete: false },
    reports: { view: false },
  },
  warehouse: {
    inventory: { create: false, edit: false, delete: false, create_movement: true, delete_movement: false },
    sales: { create: false, edit: false, delete: false },
    reports: { view: false },
  },
};

function defaultFor(module: string, action: string, role: CustomizableRole): boolean {
  return DEFAULTS[role]?.[module]?.[action] ?? false;
}
