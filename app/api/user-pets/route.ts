import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createUserPet, deleteUserPet, getUserPets, type PetPhotoView } from '@/lib/supabase';

const PET_VIEWS: PetPhotoView[] = ['front', 'side', 'back'];
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

function validatePetFile(file: File | null, view: PetPhotoView): file is File {
  if (!file) {
    throw new Error(`${view} photo is required.`);
  }
  if (!file.type.startsWith('image/')) {
    throw new Error(`${view} photo must be an image.`);
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`${view} photo is too large. Maximum size is 8MB.`);
  }
  if (file.name.length > 255) {
    throw new Error(`${view} file name is too long.`);
  }
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pets = await getUserPets(userId);
    return NextResponse.json({ success: true, pets });
  } catch (error) {
    console.error('[user-pets] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pets' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const petName = String(formData.get('petName') || '').trim();
    if (!petName) {
      return NextResponse.json({ error: 'Pet name is required.' }, { status: 400 });
    }
    if (petName.length > 255) {
      return NextResponse.json({ error: 'Pet name is too long.' }, { status: 400 });
    }

    const files = PET_VIEWS.reduce((acc, view) => {
      const file = formData.get(view) as File | null;
      validatePetFile(file, view);
      acc[view] = file as File;
      return acc;
    }, {} as Record<PetPhotoView, File>);

    const pet = await createUserPet(userId, petName, files);
    return NextResponse.json({ success: true, pet, message: 'Pet saved successfully' });
  } catch (error) {
    console.error('[user-pets] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save pet';
    const status = message.includes('required') || message.includes('too large') || message.includes('image') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const petId = searchParams.get('petId');
    if (!petId) {
      return NextResponse.json({ error: 'Pet ID is required.' }, { status: 400 });
    }

    await deleteUserPet(petId, userId);
    return NextResponse.json({ success: true, message: 'Pet deleted successfully' });
  } catch (error) {
    console.error('[user-pets] DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete pet';
    return NextResponse.json({ error: message }, { status: message.includes('not found') ? 404 : 500 });
  }
}
