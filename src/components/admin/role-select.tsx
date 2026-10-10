"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { changeUserRole } from "@/lib/admin/actions";
import type { FormState } from "@/lib/validation/auth";
import type { Role } from "@/lib/auth/roles";

export function RoleSelect({ userId, role, disabled }: { userId: string; role: Role; disabled?: boolean }) {
  const [state, action, pending] = useActionState(changeUserRole, {} as FormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        key={`${role}-${state.ok ? "ok" : state.message ?? ""}`}
        disabled={disabled || pending}
        aria-label="Role"
        onChange={(e) => {
          const label = e.target.selectedOptions[0]?.text;
          if (confirm(`Change this user's role to ${label}?`)) formRef.current?.requestSubmit();
          else e.target.value = role;
        }}
        className="h-9 rounded-md border bg-card px-2 text-sm disabled:opacity-60"
      >
        <option value="customer">Customer</option>
        <option value="staff">Staff</option>
        <option value="admin">Admin</option>
      </select>
    </form>
  );
}
