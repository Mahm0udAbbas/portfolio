import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/content/site";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProjectsRing } from "@/components/projects/projects-ring";

export const metadata: Metadata = {
  title: "Projects",
  description: `Selected work by ${site.name}: ${site.projects.map((p) => p.title).join(", ")}.`,
  alternates: { canonical: "/projects" },
  openGraph: { title: `Projects — ${site.name}`, url: "/projects" },
};

/** All projects, as a 3D ring of cards around the word. Cards open the same overlay as the home page. */
export default function ProjectsPage() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="relative h-svh min-h-[560px] overflow-hidden">
          <h1 className="sr-only">Projects</h1>
          <div className="pointer-events-none absolute inset-x-0 top-(--header-h) z-10 px-4 pt-6 sm:px-8">
            <div className="mx-auto flex w-full max-w-6xl items-baseline justify-between font-mono text-sm">
              <Link href="/#projects" className="pointer-events-auto text-muted hover:text-accent-strong">
                ← cd ~
              </Link>
              <span className="text-muted">
                <span className="text-accent-strong">~/</span>projects · {String(site.projects.length).padStart(2, "0")}
              </span>
            </div>
          </div>
          <ProjectsRing projects={site.projects} />
        </section>
      </main>
      <Footer />
    </>
  );
}
