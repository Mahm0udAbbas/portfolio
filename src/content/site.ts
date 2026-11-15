/**
 * All editable portfolio content lives here.
 * Replace the placeholders (marked TODO) with real data — components read from this file only.
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
  links: { live?: string; repo?: string };
};

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
  tagline: "I build interfaces that feel alive — React, Next.js and a bit of Node on the side.",
  location: "TODO: City, Country",
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
      "TODO: A short paragraph about who you are and what you love building.",
      "TODO: A second paragraph — how you work, what you care about (performance, accessibility, motion…).",
    ],
    portrait: null as string | null, // e.g. "/me.jpg"
    stats: [
      { value: 0, suffix: "+", label: "Years experience" }, // TODO
      { value: 0, suffix: "", label: "Projects shipped" }, // TODO
      { value: 999, suffix: "", label: "Cups of coffee" },
    ],
  },

  projects: [
    {
      slug: "project-one",
      title: "Project One",
      tagline: "TODO: one-line pitch",
      description: "TODO: What the project is, the problem it solves, and your part in it.",
      year: "2026",
      role: "Frontend",
      stack: ["Next.js", "TypeScript", "Tailwind"],
      links: {},
    },
    {
      slug: "project-two",
      title: "Project Two",
      tagline: "TODO: one-line pitch",
      description: "TODO: What the project is, the problem it solves, and your part in it.",
      year: "2025",
      role: "Full-stack",
      stack: ["React", "Node.js", "Express"],
      links: {},
    },
    {
      slug: "project-three",
      title: "Project Three",
      tagline: "TODO: one-line pitch",
      description: "TODO: What the project is, the problem it solves, and your part in it.",
      year: "2025",
      role: "Frontend",
      stack: ["Next.js", "GSAP", "Three.js"],
      links: {},
    },
    {
      slug: "project-four",
      title: "Project Four",
      tagline: "TODO: one-line pitch",
      description: "TODO: What the project is, the problem it solves, and your part in it.",
      year: "2024",
      role: "Frontend",
      stack: ["React", "Redux", "REST"],
      links: {},
    },
  ] satisfies Project[] as Project[],

  skills: [
    { label: "Frontend", items: ["React", "Next.js", "TypeScript", "JavaScript", "HTML", "CSS", "Tailwind"] },
    { label: "Motion & 3D", items: ["GSAP", "Three.js", "R3F", "Framer Motion"] },
    { label: "Backend", items: ["Node.js", "Express", "REST", "MongoDB"] },
    { label: "Tooling", items: ["Git", "Vite", "Figma", "Vercel"] },
  ] satisfies SkillGroup[],

  experience: [
    {
      hash: "a3f9c1e",
      role: "Frontend Engineer",
      company: "TODO: Company",
      period: "2024 — now",
      points: ["TODO: Impact you had", "TODO: Something you built or led"],
    },
    {
      hash: "7b2d04f",
      role: "Junior Frontend Developer",
      company: "TODO: Company",
      period: "2022 — 2024",
      points: ["TODO: Impact you had", "TODO: Something you built or led"],
    },
  ] satisfies Experience[] as Experience[],

  contact: {
    email: "you@example.com", // TODO
    phone: "+00 000 000 0000", // TODO
    github: { handle: "your-github", url: "https://github.com/your-github" }, // TODO
    linkedin: { handle: "your-linkedin", url: "https://www.linkedin.com/in/your-linkedin" }, // TODO
    cv: "/cv.pdf", // TODO: drop your CV at public/cv.pdf
  } satisfies Contact,

  /** Lines typed by the terminal preloader (milestone 2). */
  preloader: [
    { cmd: "whoami", out: "mahmoud_abbas — frontend engineer" },
    { cmd: "load --stack react next node express", out: "stack loaded ✓" },
    { cmd: "fetch projects", out: "4 projects found ✓" },
    { cmd: "render portfolio", out: "" },
  ] satisfies PreloaderLine[],
};

export type Site = typeof site;

export const getProject = (slug: string) => {
  const index = site.projects.findIndex((p) => p.slug === slug);
  return index === -1 ? null : { project: site.projects[index], index };
};
