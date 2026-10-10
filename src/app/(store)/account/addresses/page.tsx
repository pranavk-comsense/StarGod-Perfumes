import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AddressBook } from "@/components/account/address-book";

export const metadata: Metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("id, name, phone, line1, line2, landmark, city, state, pincode, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at");

  return <AddressBook addresses={data ?? []} defaultName={user.fullName ?? ""} defaultPhone={user.phone ?? ""} />;
}
