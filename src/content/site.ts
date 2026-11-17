/**
 * All editable portfolio content lives here.
 * Components read from this file only — edit content here, never in the components.
 */

export type NavItem = { id: SectionId; label: string };
export type SectionId = "hero" | "about" | "projects" | "skills" | "experience" | "contact";

export type Project = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  year: string;
  role: string;
  stack: string[];
  /** Image or short muted video shown on hover / in the overlay. Put files in /public/projects/<slug>/ */
  media?: { type: "image" | "video"; src: string; alt: string };
  /** Full-page captures of the live site, shown as scrolling browser + phone mockups. */
  screens?: { desktop: Screen; mobile: Screen; alt: string };
  links: { live?: string; repo?: string };
};

export type Screen = { src: string; width: number; height: number };

export type Experience = {
  hash: string; // fake commit hash shown in the git-log style timeline
  role: string;
  company: string;
  period: string;
  location?: string;
  points: string[];
};

export type SkillGroup = { label: string; items: string[] };

export type Contact = {
  email: string;
  phone: string;
  github: { handle: string; url: string };
  linkedin: { handle: string; url: string };
  cv: string; // path under /public
};

export type PreloaderLine = { cmd: string; out?: string };

export const site = {
  name: "Mahmoud Abbas",
  handle: "mahmoud_abbas",
  role: "Frontend Engineer",
  tagline: "I build fast, bilingual React & Next.js products — dashboards, storefronts and everything in between.",
  location: "Cairo, Egypt",
  year: "2026", // footer copyright (static so the page prerenders fully)

  nav: [
    { id: "about", label: "About" },
    { id: "projects", label: "Projects" },
    { id: "skills", label: "Skills" },
    { id: "experience", label: "Experience" },
    { id: "contact", label: "Contact" },
  ] satisfies NavItem[],

  about: {
    bio: [
      "I'm a frontend engineer in Cairo with 2 years of professional experience shipping production React and Next.js applications — booking platforms, marketplaces, e-commerce storefronts and multi-role dashboards.",
      "I care about the details people actually feel: fast first loads, solid forms and validation, bilingual RTL/LTR layouts, SEO that holds up, and component systems a team can keep building on. At Nami Tech I own frontend delivery end to end and lead task breakdown across the team.",
      "Before code, I studied civil engineering — I still like building things that stand up.",
    ],
    portrait: null as string | null, // e.g. "/me.jpg" (drop the file in /public)
    stats: [
      { value: 2, suffix: "+", label: "Years experience" },
      { value: 6, suffix: "", label: "Live products" },
      { value: 90, suffix: "+", label: "Lighthouse (mobile)" },
    ],
  },

  projects: [
    {
      slug: "t-car",
      title: "T-Car",
      tagline: "Car rental marketplace — find, compare and book cars across Saudi Arabia.",
      description:
        "A bilingual (Arabic/English, RTL/LTR) car rental platform where customers find cars by city, airport or train station, filter and compare offers from rental companies, and book daily, monthly or international rentals. I built the Next.js App Router frontend end to end: URL-driven listing filters with pagination, car details and the full booking flow (coupons, Tabby/Tamara and wallet payments, extensions, cancellations and ratings), phone OTP sign-in with NextAuth, Google Maps location, Firebase push notifications, and the customer account — bookings, wallet, bank accounts and loyalty points. Mutations run through server actions with Zod validation, backed by 130+ Vitest test files.",
      year: "2026",
      role: "Frontend",
      stack: ["Next.js 15", "TypeScript", "next-intl", "NextAuth", "Tailwind", "Zod", "Zustand", "Vitest"],
      links: { live: "https://t-car.app/en" },
      screens: {
        desktop: { src: "/projects/t-car/desktop.webp", width: 1280, height: 5691 },
        mobile: { src: "/projects/t-car/mobile.webp", width: 440, height: 5934 },
        alt: "T-Car car rental marketplace",
      },
    },
    {
      slug: "joocare",
      title: "JooCare",
      tagline: "AI-powered hiring platform for healthcare and life sciences.",
      description:
        "A bilingual (Arabic/English) recruitment platform connecting healthcare professionals with employers. In phase one I led the frontend architecture and technical decisions and shaped the overall product direction — setting up the Next.js App Router foundation with next-intl, TanStack Query and a shadcn/ui design system. I built the home page, server-side job search with filters, SEO metadata and structured data, job details, applications and saved jobs; the candidate profile with experience, education, skills and credentials; role-based auth for candidates and employers with Google and LinkedIn sign-in; the employer dashboard with a multi-step job-post form, job management and applicant review; and Firebase push notifications with a role-aware notification drawer.",
      year: "2026",
      role: "Frontend Lead",
      stack: ["Next.js 16", "TypeScript", "TanStack Query", "next-intl", "shadcn/ui", "NextAuth", "Zod", "Firebase"],
      links: { live: "https://www.joocare.com/en", repo: "https://github.com/Nami-Design-New/joocare" },
      screens: {
        desktop: { src: "/projects/joocare/desktop.webp", width: 1280, height: 6621 },
        mobile: { src: "/projects/joocare/mobile.webp", width: 440, height: 7897 },
        alt: "JooCare healthcare hiring platform",
      },
    },
    {
      slug: "nuaris",
      title: "Nuaris",
      tagline: "Yacht reservation system with live availability and calendar booking.",
      description:
        "A live yacht booking platform with availability checks, calendar-driven reservation flows and backend validation. I shipped the booking experience and focused hard on performance — cutting initial page load time by 25% and reaching a 90+ Lighthouse performance score on mobile.",
      year: "2025",
      role: "Frontend",
      stack: ["Booking flows", "Calendars", "Performance"],
      links: { live: "https://frontend.nuaris.co" },
      screens: {
        desktop: { src: "/projects/nuaris/desktop.webp", width: 1280, height: 4101 },
        mobile: { src: "/projects/nuaris/mobile.webp", width: 440, height: 7897 },
        alt: "Nuaris yacht booking site",
      },
    },
    {
      slug: "ditchit",
      title: "Ditchit",
      tagline: "Local marketplace for buying and selling.",
      description:
        "Marketplace UI flows for browsing categories, viewing listings and posting items on a local buying-and-selling platform. Built responsive listing pages and reusable components with the Next.js App Router, TypeScript, shadcn/ui, Tailwind, Zod and Zustand, using SSR/SSG patterns.",
      year: "2025",
      role: "Frontend",
      stack: ["Next.js", "TypeScript", "shadcn/ui", "Tailwind", "Zustand", "Zod"],
      links: { live: "https://ditchit.com" },
      screens: {
        desktop: { src: "/projects/ditchit/desktop.webp", width: 1280, height: 6222 },
        mobile: { src: "/projects/ditchit/mobile.webp", width: 440, height: 7897 },
        alt: "Ditchit local marketplace",
      },
    },
    {
      slug: "monsbah",
      title: "Monsbah",
      tagline: "Fashion e-commerce — consumer storefront and merchant dashboard.",
      description:
        "Migrated the public storefront from React CSR to the Next.js 15 App Router for proper SSR and SEO readiness. Built merchant dashboard and consumer storefront flows across 5 product categories with React Hook Form and Zod, plus the SEO foundations: dynamic metadata, localized XML sitemaps, canonical tags, hreflang and a custom robots.txt.",
      year: "2025",
      role: "Frontend",
      stack: ["Next.js 15", "React Hook Form", "Zod", "SEO", "i18n"],
      links: { live: "https://monsbah.com" },
      screens: {
        desktop: { src: "/projects/monsbah/desktop.webp", width: 1280, height: 5493 },
        mobile: { src: "/projects/monsbah/mobile.webp", width: 440, height: 7897 },
        alt: "Monsbah fashion storefront",
      },
    },
    {
      slug: "tasamii",
      title: "Tasamii",
      tagline: "Goal-coaching platform across 300+ specialization fields.",
      description:
        "Goal-setting, task management, opportunity and coaching features across 300+ specialization fields. Engineered a 5-role dashboard with permission-based views, CRUD workflows, TanStack Table and form validation, and implemented private/group chat, wallet and Maysir payment flows, and Arabic/English localization with RTL/LTR switching.",
      year: "2025",
      role: "Frontend",
      stack: ["React", "TanStack Table", "RTL/LTR", "Chat", "Payments"],
      links: { live: "https://tasamii.com" },
      screens: {
        desktop: { src: "/projects/tasamii/desktop.webp", width: 1280, height: 1872 },
        mobile: { src: "/projects/tasamii/mobile.webp", width: 440, height: 3022 },
        alt: "Tasamii goal-coaching platform",
      },
    },
  ] satisfies Project[] as Project[],

  /** Projects stacked on the home page, in this order (slugs from `projects`). The rest are on /projects. */
  homeProjects: ["ditchit", "joocare", "monsbah"],

  skills: [
    { label: "Languages", items: ["HTML5", "CSS3", "JavaScript", "TypeScript"] },
    { label: "Frameworks", items: ["React", "Next.js", "React Router"] },
    { label: "State & Data", items: ["Redux Toolkit", "Redux Thunk", "TanStack Query", "TanStack Table", "Zustand"] },
    { label: "Forms", items: ["React Hook Form", "Zod", "Yup"] },
    {
      label: "Styling",
      items: ["Tailwind CSS", "SASS/SCSS", "shadcn/ui", "Styled Components", "CSS Modules", "Bootstrap"],
    },
    { label: "Tools & Backend", items: ["Git", "GitHub", "Axios", "REST APIs", "i18next", "Firebase", "Supabase", "Node.js", "Express"] },
  ] satisfies SkillGroup[],

  experience: [
    {
      hash: "a3f9c1e",
      role: "Software Engineer — React Developer",
      company: "Nami Tech",
      period: "Jan 2025 — now",
      location: "Cairo, Egypt",
      points: [
        "Own end-to-end frontend delivery for client projects, turning requirements into reusable React and Next.js interfaces and production-ready user flows.",
        "Lead task breakdown and delegate work across the team, coordinating priorities with designers and backend developers to keep delivery on schedule.",
        "Build responsive, bilingual RTL/LTR interfaces and reusable UI components for dashboards, forms, listings and content-heavy screens.",
        "Review implementation quality and keep API integration, validation and performance work at production standard.",
      ],
    },
    {
      hash: "5e1b7d2",
      role: "Frontend & Mobile Cross-Platform Program",
      company: "Information Technology Institute (ITI)",
      period: "Nov 2023 — Apr 2024",
      points: ["Intensive training program — Frontend & Mobile Cross-Platform track."],
    },
    {
      hash: "0c4e9a1",
      role: "B.Sc. Civil Engineering",
      company: "Menoufia University",
      period: "2016 — 2021",
      points: ["Faculty of Engineering — graduated with a grade of Very Good."],
    },
  ] satisfies Experience[] as Experience[],

  contact: {
    email: "mahmoudabbas393@gmail.com",
    phone: "+20 128 193 5436",
    github: { handle: "Mahm0udAbbas", url: "https://github.com/Mahm0udAbbas" },
    linkedin: { handle: "mahmoud-abbas-45b36a259", url: "https://www.linkedin.com/in/mahmoud-abbas-45b36a259" },
    cv: "/cv.pdf",
  } satisfies Contact,

  /** Lines typed by the terminal preloader. */
  preloader: [
    { cmd: "whoami", out: "mahmoud_abbas — frontend engineer · cairo, eg" },
    { cmd: "load --stack react next typescript", out: "stack loaded ✓" },
    { cmd: "fetch projects", out: "4 live projects found ✓" },
    { cmd: "render portfolio", out: "" },
  ] satisfies PreloaderLine[],
};

export type Site = typeof site;

export const getProject = (slug: string) => {
  const index = site.projects.findIndex((p) => p.slug === slug);
  return index === -1 ? null : { project: site.projects[index], index };
};
