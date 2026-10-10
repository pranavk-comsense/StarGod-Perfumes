import { z } from "zod";
import { phoneSchema } from "@/lib/validation/auth";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3, "Enter house / flat and street").max(200),
  line2: optional(200),
  landmark: optional(120),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.enum(INDIAN_STATES, { error: "Choose a state" }),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  isDefault: z.literal("on").optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;

export type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

export function formatAddress(a: Pick<Address, "line1" | "line2" | "landmark" | "city" | "state" | "pincode">) {
  return [a.line1, a.line2, a.landmark, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(", ");
}
