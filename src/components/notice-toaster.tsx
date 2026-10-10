"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const NOTICES: Record<string, { type: "success" | "info" | "error"; text: string }> = {
  "signed-out": { type: "info", text: "You've been signed out." },
  "signed-out-everywhere": { type: "info", text: "You've been signed out on all devices." },
  "email-confirmed": { type: "success", text: "Email confirmed. Welcome to StarGod Perfumes!" },
  "email-updated": { type: "success", text: "Your email address has been updated." },
  "password-updated": { type: "success", text: "Your password has been updated." },
  "link-expired": { type: "error", text: "That link has expired, was already used, or was opened in a different browser. Please request a new one." },
  "link-invalid": { type: "error", text: "That link isn't valid." },
  "account-deleted": { type: "info", text: "Your account has been deleted. We're sorry to see you go." },
  "oauth-failed": { type: "error", text: "Google sign-in didn't complete. Please try again." },
};

/** Shows a one-off toast for ?notice=… (set by auth redirects), then removes the param. */
export function NoticeToaster() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notice = params.get("notice");

  useEffect(() => {
    if (!notice) return;
    const n = NOTICES[notice];
    if (n) toast[n.type](n.text, { id: notice });
    const rest = new URLSearchParams(params);
    rest.delete("notice");
    const qs = rest.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [notice, params, pathname, router]);

  return null;
}
