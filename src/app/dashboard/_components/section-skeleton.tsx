/** Loading placeholder for list pages. */
export function SectionSkeleton() {
  return (
    <div aria-busy className="flex animate-pulse flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="h-9 w-40 rounded-lg bg-foreground/10" />
        <div className="h-11 w-32 rounded-full bg-foreground/10" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-foreground/5" />
        ))}
      </div>
    </div>
  );
}
