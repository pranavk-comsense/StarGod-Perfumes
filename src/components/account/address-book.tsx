"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPinIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { deleteAddress, setDefaultAddress } from "@/lib/account/actions";
import { formatAddress, type Address } from "@/lib/validation/address";
import { AddressForm } from "@/components/account/address-form";
import { Button } from "@/components/ui/button";

export function AddressBook({ addresses, defaultName, defaultPhone }: { addresses: Address[]; defaultName: string; defaultPhone: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length === 0 ? "new" : null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4">
      {addresses.map((a) =>
        editing === a.id ? (
          <div key={a.id} className="rounded-md border bg-card p-5">
            <h3 className="mb-4 font-medium">Edit address</h3>
            <AddressForm address={a} onSaved={() => setEditing(null)} />
            <Button variant="ghost" className="mt-2" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div key={a.id} className="flex gap-4 rounded-md border bg-card p-5">
            <MapPinIcon className="mt-0.5 size-5 shrink-0 text-gold" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {a.name}{" "}
                {a.is_default && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wider">Default</span>}
              </p>
              <p className="mt-1 text-muted-foreground">{formatAddress(a)}</p>
              <p className="text-muted-foreground">+91 {a.phone}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <button type="button" className="flex items-center gap-1 hover:underline" onClick={() => setEditing(a.id)}>
                  <PencilIcon className="size-3.5" /> Edit
                </button>
                {!a.is_default && (
                  <button
                    type="button"
                    disabled={pending}
                    className="hover:underline"
                    onClick={() => startTransition(async () => void (await setDefaultAddress(a.id)))}
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  className="flex items-center gap-1 text-destructive hover:underline"
                  onClick={() => {
                    if (!confirm("Delete this address?")) return;
                    startTransition(async () => {
                      const r = await deleteAddress(a.id);
                      if (r.ok) toast.success("Address deleted");
                    });
                  }}
                >
                  <Trash2Icon className="size-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        ),
      )}

      {editing === "new" ? (
        <div className="rounded-md border bg-card p-5">
          <h3 className="mb-4 font-medium">New address</h3>
          <AddressForm
            defaultName={defaultName}
            defaultPhone={defaultPhone}
            onSaved={() => {
              setEditing(null);
              toast.success("Address saved");
            }}
          />
          {addresses.length > 0 && (
            <Button variant="ghost" className="mt-2" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          )}
        </div>
      ) : (
        <Button variant="outline" className="w-fit" onClick={() => setEditing("new")}>
          <PlusIcon /> Add a new address
        </Button>
      )}
    </div>
  );
}
