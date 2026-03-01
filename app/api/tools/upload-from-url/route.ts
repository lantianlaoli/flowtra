import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { STORAGE_BUCKETS } from '@/lib/storage/types';

const KIE_UPLOAD_ENDPOINT = 'https://kieai.redpandaai.co/api/file-url-upload';

/**
 * POST /api/tools/upload-from-url
 * Uses a temporary Supabase file URL to upload into KIE, then deletes the temp file.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { path, fileName, fileType } = body as { path?: string; fileName?: string; fileType?: string };

    if (!path || !fileName || !fileType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: signedData, error: signedError } = await supabase.storage
      .from(STORAGE_BUCKETS.tempUploads)
      .createSignedUrl(path, 600);

    if (signedError || !signedData?.signedUrl) {
      console.error('[POST /api/tools/upload-from-url] Error creating signed URL:', signedError);
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 });
    }

    let result: any = null;
    let response: Response | null = null;
    try {
      response = await fetchWithRetry(KIE_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KIE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileUrl: signedData.signedUrl,
          uploadPath: 'tools/temporary',
          fileName
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[tools/upload-from-url] KIE upload failed:', response.status, errorText);
        return NextResponse.json(
          { error: 'KIE upload failed', details: errorText },
          { status: response.status }
        );
      }

      result = await response.json();
      if (!result?.success || !result?.data?.downloadUrl) {
        console.error('[tools/upload-from-url] KIE upload error response:', result);
        return NextResponse.json(
          { error: result?.msg || 'KIE upload failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        downloadUrl: result.data.downloadUrl,
        fileName: result.data.fileName,
        filePath: result.data.filePath,
        fileSize: result.data.fileSize,
        mimeType: result.data.mimeType,
        uploadedAt: result.data.uploadedAt,
        source: 'supabase-temp',
        originalFileType: fileType
      });
    } finally {
      const { error: deleteError } = await supabase.storage.from(STORAGE_BUCKETS.tempUploads).remove([path]);
      if (deleteError) {
        console.error('[tools/upload-from-url] Temp file cleanup failed:', deleteError);
      }
    }
  } catch (error) {
    console.error('[tools/upload-from-url] Unexpected error:', error);
    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error, details: networkError.details },
      { status: networkError.status }
    );
  }
}
