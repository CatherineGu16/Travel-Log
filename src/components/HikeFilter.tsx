/** "Find a hike", for parks with a long list of trails. */
export function HikeFilter({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <input
      type="search"
      aria-label="Find a hike"
      placeholder="Find a hike"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-2 h-10 w-full min-w-0 rounded-lg border border-line bg-bg px-3 text-base"
    />
  )
}
