import Link from "next/link";
import { site } from "@/content/site";
import { Section } from "@/components/ui/section";
import { ProjectStack } from "@/components/projects/project-stack";

const homeProjects = site.homeProjects
  .map((slug) => site.projects.find((p) => p.slug === slug))
  .filter((p) => p !== undefined);

export function Projects() {
  return (
    <Section id="projects" label="projects">
      <h2 className="mb-14 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Selected work<span className="text-accent-strong">.</span>
      </h2>
      <ProjectStack projects={homeProjects} />
      <div className="flex justify-center">
        <Link
          href="/projects"
          className="group inline-flex items-center gap-3 rounded-md border border-line bg-surface px-5 py-3 font-mono text-sm transition-colors hover:border-accent hover:text-accent-strong"
        >
          <span className="text-accent-strong">❯</span> show more
          <span className="text-muted">({site.projects.length} projects)</span>
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </Section>
  );
}
