interface PlaceholderPageProps {
  title: string;
  detail: string;
}

export function PlaceholderPage({ title, detail }: PlaceholderPageProps) {
  return (
    <section className="placeholder-panel">
      <p className="eyebrow">Scaffolded route</p>
      <h1>{title}</h1>
      <p>{detail}</p>
    </section>
  );
}
