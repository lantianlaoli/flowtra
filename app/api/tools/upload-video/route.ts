import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';

const KIE_UPLOAD_ENDPOINT = 'https://kieai.redpandaai.co/api/file-stream-upload';
export const experimental_bodySizeLimit = 500 * 1024 * 1024; // 500MB for video uploads

const buildSafeFileName = (originalName: string) => {
  const nameParts = originalName.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop() : 'mp4';
  return `video-${Date.now()}.${ext}`;
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'File must be a video' }, { status: 400 });
    }

    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('uploadPath', 'tools/video-uploads');
    uploadForm.append('fileName', buildSafeFileName(file.name));

    const response = await fetchWithRetry(KIE_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      },
      body: uploadForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tools/upload-video] KIE upload failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'KIE upload failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    if (!result?.success || !result?.data?.downloadUrl) {
      console.error('[tools/upload-video] KIE upload error response:', result);
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
    });
  } catch (error) {
    console.error('[tools/upload-video] Unexpected error:', error);
    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error, details: networkError.details },
      { status: networkError.status }
    );
  }
}
