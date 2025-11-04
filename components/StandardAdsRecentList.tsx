'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface StandardAdProject {
  id: string;
  createdAt: string;
  coverImageUrl?: string;
  videoUrl?: string;
  description?: string;
  videoModel?: string;
  status?: string;
  videoDuration?: string;
  videoQuality?: 'standard' | 'high';
}

interface ApiResponse {
  success: boolean;
  projects?: StandardAdProject[];
  error?: string;
}

export function StandardAdsRecentList() {
  const [projects, setProjects] = useState<StandardAdProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/public/standard-ads-recent', {
          method: 'GET',
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as ApiResponse;

        if (!payload.success) {
          throw new Error(payload.error || 'Unknown error');
        }

        if (!cancelled) {
          setProjects(payload.projects ?? []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load projects');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-600">Loading recent standard ads…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-700">Failed to load standard ads</p>
        <p className="mt-2 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-neutral-600">No standard ads found yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {projects.map((project) => {
        const createdDate = new Date(project.createdAt);
        const formattedDate = Number.isNaN(createdDate.getTime())
          ? project.createdAt
          : createdDate.toLocaleString();

        return (
          <article
            key={project.id}
            className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-neutral-300"
          >
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Project {project.id.slice(0, 8)}</h2>
                <p className="mt-1 text-sm text-neutral-500">Created {formattedDate}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-sm text-neutral-600">
                {project.status && <span className="font-medium capitalize text-neutral-900">{project.status}</span>}
                {project.videoModel && <span>Model: {project.videoModel}</span>}
                {project.videoQuality && <span>Quality: {project.videoQuality}</span>}
                {project.videoDuration && <span>Duration: {project.videoDuration}s</span>}
              </div>
            </header>

            {project.description && (
              <p className="mt-4 text-sm text-neutral-700">
                <span className="font-medium text-neutral-900">Description: </span>
                {project.description}
              </p>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {project.coverImageUrl && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-neutral-700">Cover Image</span>
                  <div className="relative h-48 w-full">
                    <Image
                      src={project.coverImageUrl}
                      alt={`Cover image for project ${project.id}`}
                      fill
                      className="rounded-md object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                </div>
              )}

              {project.videoUrl && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-neutral-700">Video</span>
                  <video
                    src={project.videoUrl}
                    controls
                    className="h-48 w-full rounded-md bg-black object-cover"
                    preload="none"
                  />
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default StandardAdsRecentList;
