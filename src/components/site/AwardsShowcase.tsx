import { Container } from "./Container";

type Award = { year: string; title: string };

export function AwardsShowcase({
  heading,
  awards,
}: {
  heading: string;
  awards: readonly Award[];
}) {
  return (
    <section className="bg-[var(--igh-surface)] py-12 sm:py-16">
      <Container>
        <h2 className="mb-10 text-center text-xl font-semibold leading-snug text-[var(--igh-secondary)] sm:mb-12 sm:text-2xl lg:text-3xl">
          {heading}
        </h2>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {awards.map((a) => (
            <article
              key={`${a.year}-${a.title}`}
              className="rounded-xl border border-[var(--igh-border)] bg-white/60 px-4 py-5 text-center shadow-sm sm:px-5 sm:text-left"
            >
              <p className="text-3xl font-bold tabular-nums text-[var(--igh-primary)] sm:text-4xl">{a.year}</p>
              <p className="mt-3 text-sm font-medium leading-snug text-[var(--igh-muted)] sm:text-base">{a.title}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
