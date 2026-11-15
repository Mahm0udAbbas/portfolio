import { site } from "@/content/site";
import { Section } from "@/components/ui/section";
import { ProjectStack } from "@/components/projects/project-stack";

export function Projects() {
  return (
    <Section id="projects" label="projects">
      <h2 className="mb-14 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Selected work<span className="text-accent-strong">.</span>
      </h2>
      <ProjectStack projects={site.projects} />
    </Section>
  );
}
