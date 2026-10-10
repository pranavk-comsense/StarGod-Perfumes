import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address")
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

/** Mirrors Supabase Auth: min 8, lower + upper + digit (supabase/config.toml). */
export const newPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

/** Indian mobile number; accepts +91 / 0 prefixes and spaces, returns 10 digits. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));

const optionalPhone = z.union([z.literal("").transform(() => null), phoneSchema]);

const nameSchema = z.string().trim().min(2, "Enter your full name").max(80, "Name is too long");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(72),
});

export const signUpSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    phone: optionalPhone,
    password: newPasswordSchema,
    confirmPassword: z.string(),
    terms: z.literal("on", { error: "Please accept the Terms and Privacy Policy" }),
    marketing: z.literal("on").optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const emailOnlySchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })
  .refine((d) => d.password !== d.currentPassword, {
    path: ["password"],
    message: "Choose a password different from your current one",
  });

export const profileSchema = z.object({
  fullName: nameSchema,
  phone: optionalPhone,
  marketing: z.literal("on").optional(),
});

/** Shape returned by every form action and consumed by useActionState. */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Echoed back so inputs keep their values after a failed submit (never passwords). */
  values?: Record<string, string>;
  /** Login only: the email needs confirming before sign-in. */
  unverifiedEmail?: string;
};

export function fieldErrors(error: z.ZodError): FormState["fieldErrors"] {
  return z.flattenError(error).fieldErrors as FormState["fieldErrors"];
}

/** Text form fields as a plain object, excluding passwords. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.toLowerCase().includes("password") && !key.startsWith("$")) {
      values[key] = value;
    }
  }
  return values;
}
