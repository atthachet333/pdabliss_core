import { Search } from 'lucide-react';

/** A labelled search field with its icon — shared by the Master Data and purchase-request lists. */
export function SearchBox({
  id,
  label,
  value,
  onChange,
  placeholder,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  describedBy: string;
}) {
  return (
    <div className="sm:col-span-2 lg:col-span-1">
      <label htmlFor={id} className="mb-2 block text-label font-medium text-text-primary">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
        />
        <input
          id={id}
          type="search"
          value={value}
          maxLength={100}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          className="min-h-12 w-full rounded-xl bg-white/[0.04] py-2 pr-3 pl-9 text-label text-text-primary shadow-[inset_0_0_0_1px_rgb(190_235_222/0.14)] placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          data-search
        />
      </div>
    </div>
  );
}
