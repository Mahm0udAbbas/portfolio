import { ImageResponse } from "next/og";
import { site } from "@/content/site";

/** Link-preview card (LinkedIn, WhatsApp, X, Slack…) — generated at build time. */
export const alt = `${site.name} — ${site.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#111318";
const MUTED = "#646A78";
const ACCENT = "#FF9A5C";
const ACCENT_TEXT = "#C2410C";

export default function OpengraphImage() {
  const stack = ["React", "Next.js", "TypeScript", "Tailwind"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#EEF0F4",
          padding: 72,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
          <div style={{ display: "flex", fontSize: 28, color: ACCENT_TEXT }}>$ whoami</div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, color: INK, letterSpacing: -3, marginTop: 12 }}>
            {site.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 38, color: MUTED, marginTop: 8 }}>
            {site.role}
            <div style={{ display: "flex", width: 22, height: 8, background: ACCENT, marginLeft: 10, marginTop: 22 }} />
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#353A45", marginTop: 28, lineHeight: 1.35 }}>
            {site.tagline}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            {stack.map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  fontSize: 22,
                  color: INK,
                  background: "#FFFFFF",
                  border: "2px solid #D9DDE5",
                  borderBottom: "6px solid #D9DDE5",
                  borderRadius: 10,
                  padding: "8px 16px",
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: 300,
            height: 300,
            borderRadius: 48,
            background: "#FFFFFF",
            border: "2px solid #D9DDE5",
            boxShadow: "0 30px 60px -20px rgba(17,19,24,0.25)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="200" height="200" viewBox="0 0 64 64">
            <path
              d="M10 48V16l14 18 14-18 14 16-14 16"
              fill="none"
              stroke={INK}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="44" y="47" width="12" height="5" rx="1" fill={ACCENT} />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
