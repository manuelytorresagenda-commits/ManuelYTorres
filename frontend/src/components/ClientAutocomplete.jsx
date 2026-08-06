import { useEffect, useRef, useState } from "react";
import { fetchClients } from "../lib/api";

/**
 * Client name input with debounced autocomplete.
 *
 * Props:
 *  - value: current name string
 *  - onChange(name): called when text changes
 *  - onPick(client): called when user picks a client from the dropdown
 *  - testid: data-testid for the underlying input
 *  - placeholder
 */
export default function ClientAutocomplete({
  value,
  onChange,
  onPick,
  testid = "client-name-autocomplete",
  placeholder = "Nombre completo",
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const skipNextSearch = useRef(false);

  // Debounced search
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = (value || "").trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await fetchClients(q);
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
        setOpen(true);
        setActive(-1);
      } catch {
        setResults([]);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = (c) => {
    skipNextSearch.current = true;
    setOpen(false);
    setActive(-1);
    onChange(c.name || "");
    onPick && onPick(c);
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && active < results.length) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input
        data-testid={testid}
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full border border-black px-4 py-3 bg-white outline-none focus:ring-1 focus:ring-black focus:ring-offset-2 font-serif-display text-lg"
      />
      {open && results.length > 0 && (
        <ul
          data-testid={`${testid}-list`}
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-black max-h-64 overflow-y-auto shadow-lg"
        >
          {results.map((c, i) => (
            <li
              key={c.id || `${c.name}-${i}`}
              data-testid={`${testid}-option-${i}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={`px-4 py-2 cursor-pointer border-b border-neutral-200 last:border-b-0 ${
                active === i ? "bg-black text-white" : "hover:bg-neutral-100"
              }`}
            >
              <div className="font-serif-display text-base leading-tight">{c.name}</div>
              <div className={`font-mono-label text-[9px] mt-0.5 ${active === i ? "text-white/70" : "text-neutral-500"}`}>
                {[c.phone, c.instagram ? `@${c.instagram}` : "", c.tiktok ? `tt:@${c.tiktok}` : ""]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
