import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

export async function getCustomerOptions(): Promise<CustomerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").select("id, name, phone").order("name");
  if (error) {
    console.error("[Inventra] getCustomerOptions failed:", error);
    throw new Error("Could not load customers.");
  }
  return data ?? [];
}
