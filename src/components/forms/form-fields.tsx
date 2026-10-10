"use client";

import { useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { EyeIcon, EyeOffIcon, Loader2Icon, CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = Omit<ComponentProps<"input">, "name"> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
};

export function Field({ name, label, errors, hint, className, id, ...props }: FieldProps) {
  const inputId = id ?? `f-${name}`;
  const describedBy = errors?.length ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input id={inputId} name={name} aria-invalid={errors?.length ? true : undefined} aria-describedby={describedBy} {...props} />
      <FieldMessage id={inputId} errors={errors} hint={hint} />
    </div>
  );
}

export function PasswordField({ name, label, errors, hint, className, id, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? `f-${name}`;
  const describedBy = errors?.length ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={errors?.length ? true : undefined}
          aria-describedby={describedBy}
          className="pr-11"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      <FieldMessage id={inputId} errors={errors} hint={hint} />
    </div>
  );
}

function FieldMessage({ id, errors, hint }: { id: string; errors?: string[]; hint?: string }) {
  if (errors?.length) {
    return (
      <p id={`${id}-error`} className="text-xs text-destructive">
        {errors[0]}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    );
  }
  return null;
}

export function SubmitButton({ children, className, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} className={cn("w-full", className)} {...props}>
      {pending && <Loader2Icon className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormAlert({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex gap-2 rounded-md border px-3 py-2.5 text-sm",
        ok ? "border-success/30 bg-success/5 text-foreground" : "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {ok ? <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />}
      <p>{message}</p>
    </div>
  );
}

export function CheckboxField({ name, children, errors, defaultChecked }: { name: string; children: React.ReactNode; errors?: string[]; defaultChecked?: boolean }) {
  return (
    <div className="grid gap-1">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          aria-invalid={errors?.length ? true : undefined}
          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
        />
        <span className="text-muted-foreground">{children}</span>
      </label>
      {errors?.length ? <p className="text-xs text-destructive">{errors[0]}</p> : null}
    </div>
  );
}
