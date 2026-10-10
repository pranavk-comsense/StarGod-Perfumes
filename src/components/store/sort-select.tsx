"use client";

import { useRouter } from "next/navigation";

export function SortSelect({
  value,
  options,
  hrefs,
}: {
  value: string;
  options: { value: string; label: string }[];
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort</span>
      <select
        value={value}
        onChange={(e) => router.push(hrefs[e.target.value], { scroll: false })}
        className="h-10 rounded-md border bg-card px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
