import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getToolGenerationJob } from '@/lib/tools/job-store';
import {
  buildSocialCoverFileNameMap,
  type SocialCoverMetadata,
} from '@/lib/tools/social-cover-generator';

export const runtime = 'nodejs';
export const maxDuration = 120;

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'social-cover';
}

function extensionFromContentType(contentType: string | null) {
  if (contentType?.includes('jpeg')) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  return 'png';
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as { jobId?: string };
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    if (!jobId) {
      return NextResponse.json({ error: 'Job is required.' }, { status: 400 });
    }

    const job = await getToolGenerationJob(jobId);
    if (!job || job.tool_key !== 'social-cover-generator' || job.user_id !== userId) {
      return NextResponse.json({ error: 'Generation job not found.' }, { status: 404 });
    }

    const metadata = (job.metadata ?? {}) as SocialCoverMetadata;
    const successfulSlots = (metadata.slots ?? []).filter((slot) => slot.status === 'success' && slot.resultUrl);
    const zip = new JSZip();
    const fileNameMap = buildSocialCoverFileNameMap({
      sourceTitle: metadata.source_title,
      createdAt: new Date(job.created_at).getTime(),
      slots: metadata.slots ?? [],
    });
    const exportedFiles: Record<string, string> = {};

    for (const slot of successfulSlots) {
      try {
        const response = await fetch(slot.resultUrl!);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const contentType = response.headers.get('content-type');
        const bytes = await response.arrayBuffer();
        const ext = extensionFromContentType(contentType);
        const fileName = `${safeName(fileNameMap[slot.id] ?? slot.id)}.${ext}`;
        exportedFiles[slot.id] = fileName;
        zip.file(`covers/${fileName}`, bytes);
      } catch (error) {
        const errorName = `${safeName(fileNameMap[slot.id] ?? slot.id)}.txt`;
        exportedFiles[slot.id] = `errors/${errorName}`;
        zip.file(
          `errors/${errorName}`,
          `Failed to fetch ${slot.resultUrl}\n${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    zip.file('manifest.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      job,
      files: exportedFiles,
    }, null, 2));

    const archive = await zip.generateAsync({ type: 'arraybuffer' });
    return new Response(archive, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="social-covers.zip"',
      },
    });
  } catch (error) {
    console.error('[tools/social-cover-generator/zip] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export social cover zip.' },
      { status: 500 }
    );
  }
}
