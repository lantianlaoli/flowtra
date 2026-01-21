import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';

const KIE_UPLOAD_ENDPOINT = 'https://kieai.redpandaai.co/api/file-base64-upload';
export const experimental_bodySizeLimit = 20 * 1024 * 1024; // 20MB for base64 image uploads

const buildSafeFileName = (originalName: string) => {
  const nameParts = originalName.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop() : 'png';
  return `image-${Date.now()}.${ext}`;
};

export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const { base64Data, fileName } = await request.json();
    if (!base64Data) {
      return NextResponse.json({ error: 'Missing base64Data' }, { status: 400 });
    }

    const payload = {
      base64Data,
      uploadPath: 'tools/image-uploads',
      fileName: buildSafeFileName(fileName || 'upload.png'),
    };

    const response = await fetchWithRetry(KIE_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tools/upload-image-base64] KIE upload failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'KIE upload failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    if (!result?.success || !result?.data?.downloadUrl) {
      console.error('[tools/upload-image-base64] KIE upload error response:', result);
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
    console.error('[tools/upload-image-base64] Unexpected error:', error);
    const networkError = getNetworkErrorResponse(error);
    return NextResponse.json(
      { error: networkError.error, details: networkError.details },
      { status: networkError.status }
    );
  }
}
