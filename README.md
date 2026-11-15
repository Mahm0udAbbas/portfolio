# Mahmoud Abbas — Portfolio

Personal portfolio of **Mahmoud Abbas**, frontend engineer (React · Next.js · TypeScript) based in Cairo.

A dark, terminal-flavoured site with hand-built 3D: every model is generated from code in Blender and rendered in the browser with React Three Fiber.

## Highlights

- **Terminal preloader** that types out who I am, then the logo flies into the header with a bouncy landing
- **Zero-gravity UI toys** hero — a toggle, slider, cursor, braces and a "hire me" button you can poke
- **Project folders** that stick and stack on scroll, then flip open into a full-screen case study (`/projects/[slug]`)
- **Skills as 3D keycaps** with real physics (Rapier) — throw them around, type a letter, or arrange them into a keyboard
- **`Ctrl K` command terminal** — `help`, `projects`, `open 1`, `cd contact`, `sudo hire-me`…
- **Footer bugs** — ladybirds, ants and spiders in real colours crawl over the footer; click to fix them

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · GSAP + ScrollTrigger · Lenis · Three.js / React Three Fiber / drei · Rapier physics · Blender (Python-generated models, Draco-compressed glTF)

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # production build
```

## Editing content

All text lives in [`src/content/site.ts`](src/content/site.ts) — bio, projects, skills, experience, contacts and the preloader lines. Project media goes in `public/projects/<slug>/`, the CV in `public/cv.pdf`.

## 3D models

Models are built by Python scripts in [`blender/`](blender/) and sent to a running Blender (5.x, with the Blender Lab **MCP** extension) through [`tools/blender_bridge.py`](tools/blender_bridge.py):

```bash
python -I tools/blender_bridge.py blender/_helpers.py blender/build_ui_toys.py
```

Each script rebuilds its scene, renders a preview to `blender/renders/`, saves a `.blend`, and exports a Draco-compressed `.glb` to `public/models/`.
