import type { Metadata } from "next";
import { INFO_PAGES } from "@/lib/content/pages";

export function infoMetadata(slug: keyof typeof INFO_PAGES): Metadata {
  const page = INFO_PAGES[slug];
  return { title: page.title, description: page.description, alternates: { canonical: `/${slug}` } };
}

export function InfoPageView({ slug }: { slug: keyof typeof INFO_PAGES }) {
  const page = INFO_PAGES[slug];
  return (
    <article className="container-page max-w-3xl py-14">
      <h1 className="text-5xl">{page.title}</h1>
      {page.updated && <p className="mt-3 text-sm text-muted-foreground">Last updated {page.updated}</p>}
      <div className="mt-10 grid gap-8">
        {page.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2 className="text-2xl">{s.heading}</h2>}
            {s.body.map((p, j) => (
              <p key={j} className="mt-3 leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
