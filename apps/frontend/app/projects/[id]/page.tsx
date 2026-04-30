import ProjectPageClient from "../../../src/components/ProjectPageClient";

const VALID_TABS = new Set(["overview", "outline", "episodes", "characters", "storyboard", "timeline"]);

export default async function ProjectPage({ params, searchParams }: { params: any; searchParams: any }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const projectId = Number(resolvedParams.id);
  const rawTab = resolvedSearchParams?.tab;
  const initialTab = VALID_TABS.has(rawTab) ? rawTab : "overview";

  return <ProjectPageClient projectId={projectId} initialTab={initialTab} />;
}
