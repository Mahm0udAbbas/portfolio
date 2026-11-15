import { notFound } from "next/navigation";
import { getProject, site } from "@/content/site";
import { ProjectOverlay } from "@/components/projects/project-overlay";
import { ProjectDetail } from "@/components/projects/project-detail";

export function generateStaticParams() {
  return site.projects.map((p) => ({ slug: p.slug }));
}

/** Intercepted: clicking a card on the home page opens the project as an overlay. */
export default async function ProjectModal({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const found = getProject(slug);
  if (!found) notFound();
  return (
    <ProjectOverlay slug={slug}>
      <ProjectDetail project={found.project} index={found.index} />
    </ProjectOverlay>
  );
}
