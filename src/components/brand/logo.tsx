import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";

/**
 * StarGod lockup as on the store signboard: goddess emblem + "StarGod" wordmark
 * + "Premium Perfumes". `tone="light"` is for purple backgrounds.
 * Emblem is extracted from the signboard photo; replace /public/brand/emblem-*.png
 * with the original artwork when available.
 */
export function Logo({
  className,
  href = "/",
  tone = "dark",
  size = "md",
  showTagline = true,
}: {
  className?: string;
  href?: string;
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}) {
  const s = { sm: { h: 34, word: "text-xl", tag: "text-[8px]" }, md: { h: 46, word: "text-[1.7rem]", tag: "text-[9px]" }, lg: { h: 72, word: "text-5xl", tag: "text-xs" } }[size];
  return (
    <Link href={href} aria-label="StarGod Premium Perfumes, home" className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={tone === "light" ? "/brand/emblem-white-168.png" : "/brand/emblem-purple-168.png"}
        alt=""
        width={Math.round((s.h * 584) / 784)}
        height={s.h}
        priority
        unoptimized
        style={{ height: s.h, width: "auto" }}
      />
      <span className="flex flex-col leading-none">
        <span className={cn("font-brand font-extrabold tracking-tight", s.word, tone === "light" ? "text-white" : "text-primary")}>StarGod</span>
        {showTagline && (
          <span className={cn("mt-1 font-brand font-bold uppercase tracking-[0.18em]", s.tag, tone === "light" ? "text-white/90" : "text-gold")}>
            Premium Perfumes
          </span>
        )}
      </span>
    </Link>
  );
}
