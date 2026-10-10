"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { StarIcon } from "lucide-react";
import { cn } from "cn";
import { submitReview } from "@/lib/store/actions";
import type { FormState } from "@/lib/validation/auth";
import { Field, FormAlert, SubmitButton } from "@/components/forms/form-fields";
import { Label } from "@/components/ui/label";

export function ReviewForm({ productId, productSlug, signedIn }: { productId: string; productSlug: string; signedIn: boolean }) {
  const [state, action] = useActionState(submitReview, {} as FormState);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (!signedIn) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href={`/login?next=${encodeURIComponent(`/products/${productSlug}#reviews`)}`} className="text-foreground underline underline-offset-4">
          Sign in
        </Link>{" "}
        to write a review.
      </p>
    );
  }
  if (state.ok) return <FormAlert ok message={state.message} />;

  return (
    <form action={action} className="grid max-w-lg gap-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <FormAlert message={state.message} />
      <div className="grid gap-1.5">
        <Label>Your rating</Label>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              className="p-0.5"
            >
              <StarIcon className={cn("size-7 text-gold", n <= (hover || rating) ? "fill-current" : "fill-none opacity-50")} />
            </button>
          ))}
        </div>
        {state.fieldErrors?.rating && <p className="text-xs text-destructive">{state.fieldErrors.rating[0]}</p>}
      </div>
      <Field name="title" label="Title (optional)" maxLength={120} errors={state.fieldErrors?.title} />
      <div className="grid gap-1.5">
        <Label htmlFor="f-body">Your review</Label>
        <textarea
          id="f-body"
          name="body"
          rows={4}
          maxLength={2000}
          aria-invalid={state.fieldErrors?.body ? true : undefined}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          placeholder="How does it smell, last and project?"
        />
        {state.fieldErrors?.body && <p className="text-xs text-destructive">{state.fieldErrors.body[0]}</p>}
      </div>
      <SubmitButton className="w-fit" pendingText="Submitting…">
        Submit review
      </SubmitButton>
    </form>
  );
}
