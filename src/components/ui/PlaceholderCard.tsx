type PlaceholderCardProps = {
  title: string;
  items: string[];
};

export function PlaceholderCard({ title, items }: PlaceholderCardProps) {
  return (
    <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm text-zinc-600">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}