"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const SUGGESTIONS = ["Oud", "Vanilla", "Leather", "Citrus", "Tobacco", "Berry"];

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function go(q: string) {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(term)}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Search fragrances" className="flex size-10 items-center justify-center rounded-md hover:bg-white/10">
        <SearchIcon className="size-5" strokeWidth={1.5} />
      </SheetTrigger>
      <SheetContent side="top" className="pb-8">
        <SheetTitle className="sr-only">Search</SheetTitle>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            go(new FormData(e.currentTarget).get("q") as string);
          }}
          className="container-page mt-10"
        >
          <label className="flex items-center gap-3 border-b-2 border-foreground pb-3">
            <SearchIcon className="size-6 shrink-0" strokeWidth={1.5} />
            <input
              name="q"
              type="search"
              autoFocus
              maxLength={60}
              placeholder="Search perfumes or notes (oud, vanilla, citrus…)"
              className="w-full bg-transparent font-heading text-2xl outline-none placeholder:text-muted-foreground sm:text-3xl"
            />
          </label>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Popular:</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => go(s)} className="rounded-full border px-3 py-1 hover:border-foreground">
                {s}
              </button>
            ))}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
