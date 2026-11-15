"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import { site, type SectionId } from "@/content/site";
import { OPEN_TERMINAL, isPreloading, lockScroll, scrollToSection } from "@/lib/lenis";

type Kind = "in" | "out" | "ok" | "err" | "dim";
type Line = { id: number; kind: Kind; text: React.ReactNode };

const SECTIONS: SectionId[] = ["hero", "about", "projects", "skills", "experience", "contact"];
const COMMANDS = [
  ["help", "list commands"],
  ["whoami", "who is this guy"],
  ["ls", "list sections"],
  ["cd <section>", "jump to a section"],
  ["projects", "list projects"],
  ["open <n|slug>", "open a project"],
  ["skills", "print the stack"],
  ["experience", "git log of my career"],
  ["contact", "ways to reach me"],
  ["copy email", "copy email to clipboard"],
  ["cv", "download my CV"],
  ["replay", "replay the intro"],
  ["clear", "clear the screen"],
  ["exit", "close the terminal"],
] as const;
const COMPLETIONS = [
  ...COMMANDS.map(([c]) => c.split(" ")[0]),
  "git log",
  "sudo hire-me",
  ...SECTIONS.map((s) => `cd ${s}`),
  ...site.projects.map((p) => `open ${p.slug}`),
];

let nextId = 0;
const line = (kind: Kind, text: React.ReactNode): Line => ({ id: nextId++, kind, text });
const welcome = () => [
  line("dim", `${site.handle}-sh v1.0 — type "help" to see what I can do.`),
  line("dim", "tab completes · ↑↓ history · esc closes"),
];

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** Global command palette terminal. Ctrl/⌘+K or ` to toggle, or dispatch OPEN_TERMINAL. */
export function CommandTerminal() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>(welcome);
  const [value, setValue] = useState("");
  const history = useRef<string[]>([]);
  const hIndex = useRef(-1);
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const print = useCallback((...ls: Line[]) => setLines((prev) => [...prev, ...ls]), []);

  // Hotkeys + external open event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPreloading()) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "`" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_TERMINAL, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_TERMINAL, onOpen);
    };
  }, []);

  // Open: lock scroll, animate in, focus
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      gsap.fromTo(panel.current, { autoAlpha: 0, y: 16, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: "power3.out" });
    }
    input.current?.focus();
    return unlock;
  }, [open]);

  // Keep the newest output in view
  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [lines]);

  const goto = (id: string) => {
    setOpen(false);
    if (pathname !== "/") router.push(`/#${id}`);
    else scrollToSection(id);
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(site.contact.email);
      print(line("ok", `✓ copied ${site.contact.email}`));
    } catch {
      print(line("err", `couldn't access the clipboard — it's ${site.contact.email}`));
    }
  };

  const run = (raw: string) => {
    const cmdline = raw.trim();
    print(line("in", cmdline));
    if (!cmdline) return;
    history.current = [cmdline, ...history.current.filter((h) => h !== cmdline)].slice(0, 50);
    hIndex.current = -1;

    const [cmd, ...args] = cmdline.split(/\s+/);
    const arg = args.join(" ").toLowerCase();

    switch (cmd.toLowerCase()) {
      case "help":
        print(
          ...COMMANDS.map(([c, d]) =>
            line(
              "out",
              <>
                <span className="inline-block w-36 text-fg">{c}</span>
                <span className="text-muted">{d}</span>
              </>,
            ),
          ),
        );
        break;
      case "whoami":
        print(line("out", `${site.name} — ${site.role}`), line("dim", site.location));
        break;
      case "ls":
        print(line("out", SECTIONS.map((s) => `${s}/`).join("  ")));
        break;
      case "cd":
      case "goto": {
        const target = arg.replace(/^~?\/?/, "").replace(/\/$/, "") || "hero";
        if (target === ".." || target === "~") return goto("hero");
        if (SECTIONS.includes(target as SectionId)) return goto(target);
        print(line("err", `cd: no such section: ${arg}`));
        break;
      }
      case "projects":
        print(
          ...site.projects.map((p, i) =>
            line(
              "out",
              <>
                <span className="text-accent-strong">{String(i + 1).padStart(2, "0")}</span> {p.title}{" "}
                <span className="text-muted">— {p.tagline}</span>
              </>,
            ),
          ),
          line("dim", 'open one with "open 1" or "open <slug>"'),
        );
        break;
      case "open": {
        const n = Number(arg);
        const p = Number.isInteger(n) && n > 0 ? site.projects[n - 1] : site.projects.find((x) => x.slug === arg);
        if (!p) {
          print(line("err", `open: no such project: ${arg || "(none)"}`));
          break;
        }
        setOpen(false);
        router.push(`/projects/${p.slug}`, { scroll: false });
        break;
      }
      case "skills":
        print(
          ...site.skills.map((g) =>
            line(
              "out",
              <>
                <span className="inline-block w-28 text-muted">{g.label}</span>
                {g.items.join(" · ")}
              </>,
            ),
          ),
        );
        break;
      case "git":
        if (arg !== "log") {
          print(line("err", `git: '${arg}' is not a git command here. try "git log"`));
          break;
        }
      // falls through
      case "experience":
        site.experience.forEach((e) =>
          print(
            line("ok", `commit ${e.hash}`),
            line("out", `${e.role} @ ${e.company}`),
            line("dim", e.period),
          ),
        );
        break;
      case "contact":
        print(
          line("out", `email     ${site.contact.email}`),
          line("out", `phone     ${site.contact.phone}`),
          line("out", `github    ${site.contact.github.url}`),
          line("out", `linkedin  ${site.contact.linkedin.url}`),
          line("dim", 'try "copy email" or "cd contact"'),
        );
        break;
      case "copy":
        if (arg === "email") void copyEmail();
        else print(line("err", 'copy: try "copy email"'));
        break;
      case "cv":
        window.open(site.contact.cv, "_blank", "noopener");
        print(line("ok", "✓ opening cv.pdf"));
        break;
      case "replay":
        print(line("ok", "rebooting…"));
        setTimeout(() => window.location.reload(), 400);
        break;
      case "clear":
        setLines([]);
        break;
      case "exit":
      case "quit":
        setOpen(false);
        break;
      case "echo":
        print(line("out", args.join(" ")));
        break;
      case "sudo":
        if (arg === "hire-me" || arg === "hire me") {
          print(line("dim", "[sudo] password for recruiter: ********"));
          setTimeout(() => print(line("ok", "✓ access granted. excellent decision.")), 600);
          setTimeout(() => goto("contact"), 1500);
        } else {
          print(line("err", `${site.handle} is not in the sudoers file. This incident will be reported.`));
        }
        break;
      default:
        print(line("err", `command not found: ${cmd}. type "help".`));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation(); // don't also close a project overlay underneath
      setOpen(false);
    } else if (e.key === "Enter") {
      run(value);
      setValue("");
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const h = history.current;
      if (!h.length) return;
      hIndex.current =
        e.key === "ArrowUp" ? Math.min(hIndex.current + 1, h.length - 1) : Math.max(hIndex.current - 1, -1);
      setValue(hIndex.current === -1 ? "" : h[hIndex.current]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const v = value.toLowerCase();
      if (!v) return;
      const matches = COMPLETIONS.filter((c) => c.startsWith(v));
      if (matches.length === 1) setValue(matches[0] + " ");
      else if (matches.length > 1) print(line("in", value), line("dim", matches.join("   ")));
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  if (!open) return null;

  const color: Record<Kind, string> = {
    in: "text-fg",
    out: "text-fg/85",
    ok: "text-accent-strong",
    err: "text-[#ff6b6b]",
    dim: "text-muted",
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command terminal">
      <div className="absolute inset-0 bg-[#111318]/40 backdrop-blur-[3px]" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        ref={panel}
        className="term-dark relative flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface font-mono text-sm shadow-[0_30px_80px_-20px_rgba(17,19,24,0.5)]"
        onClick={() => input.current?.focus()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button type="button" aria-label="Close terminal" onClick={() => setOpen(false)} className="size-2.5 rounded-full bg-accent" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="ml-3 text-xs text-muted">{site.handle}@portfolio: {pathname}</span>
        </div>

        <div ref={body} data-lenis-prevent className="min-h-48 flex-1 space-y-1 overflow-y-auto overscroll-contain px-5 py-4" aria-live="polite">
          {lines.map((l) => (
            <div key={l.id} className={`whitespace-pre-wrap break-words ${color[l.kind]}`}>
              {l.kind === "in" ? (
                <>
                  <span className="text-accent-strong">❯</span> {l.text}
                </>
              ) : (
                l.text
              )}
            </div>
          ))}
          <label className="flex items-center gap-2">
            <span className="text-accent-strong">❯</span>
            <span className="sr-only">Command</span>
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              className="flex-1 bg-transparent text-fg caret-accent outline-none"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
