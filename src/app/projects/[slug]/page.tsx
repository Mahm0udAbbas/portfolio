import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, site } from "@/content/site";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProjectDetail } from "@/components/projects/project-detail";

export function generateStaticParams() {
  return site.projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = getProject(slug);
  return found ? { title: `${found.project.title} — ${site.name}`, description: found.project.tagline } : {};
}

/** Direct visit / refresh of a project URL: a full page instead of the overlay. */
export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const found = getProject(slug);
  if (!found) notFound();
  return (
    <>
      <Header />
      <main className="pt-(--header-h)">
        <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-8">
          <Link href="/#projects" className="font-mono text-sm text-muted hover:text-accent-strong">
            ← cd ../projects
          </Link>
        </div>
        <ProjectDetail project={found.project} index={found.index} />
      </main>
      <Footer />
    </>
  );
}
