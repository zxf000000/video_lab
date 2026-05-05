"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EpisodeShotsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(params.id);

  useEffect(() => {
    router.replace(`/projects/${projectId}/shots`);
  }, [projectId, router]);

  return null;
}
