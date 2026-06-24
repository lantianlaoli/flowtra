import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createUserPet, deleteUserPet, getUserPets, updatePetName, replacePetPhoto, type PetPhotoView } from '@/lib/supabase';

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



// PUT: Update pet name or photos
export async function PUT(request: NextRequest) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const petId = searchParams.get('petId')
    if (!petId) {
      return NextResponse.json({ error: 'Pet ID is required' }, { status: 400 })
    }

    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    let action: string | null = null
    let petName: string | undefined
    let file: File | null = null
    let view: PetPhotoView | null = null

    if (isMultipart) {
      const formData = await request.formData()
      action = typeof formData.get('action') === 'string' ? formData.get('action') as string : null
      petName = typeof formData.get('petName') === 'string' ? formData.get('petName') as string : undefined
      file = formData.get('file') as File | null
      const viewValue = formData.get('view')
      view = typeof viewValue === 'string' && ['front', 'side', 'back'].includes(viewValue)
        ? viewValue as PetPhotoView
        : null
    } else {
      const body = await request.json()
      action = typeof body.action === 'string' ? body.action : null
      petName = typeof body.petName === 'string' ? body.petName : undefined
    }

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    if (!['rename', 'replace_photo'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if (action === 'rename') {
      if (!petName || typeof petName !== 'string' || !petName.trim()) {
        return NextResponse.json({ error: 'Pet name is required' }, { status: 400 })
      }
      if (petName.trim().length > 255) {
        return NextResponse.json({ error: 'Pet name is too long' }, { status: 400 })
      }

      const updatedPet = await updatePetName(petId, userId, petName.trim())
      return NextResponse.json({
        success: true,
        pet: updatedPet,
        message: 'Pet name updated successfully'
      })
    }

    // replace_photo
    if (!view) {
      return NextResponse.json({ error: 'View must be front, side, or back' }, { status: 400 })
    }
    try {
      if (!validatePetFile(file, view)) {
        return NextResponse.json({ error: 'Invalid photo file' }, { status: 400 })
      }
    } catch (validationError) {
      return NextResponse.json(
        { error: validationError instanceof Error ? validationError.message : 'Invalid photo file' },
        { status: 400 }
      )
    }

    const updatedPet = await replacePetPhoto(petId, userId, view, file)
    return NextResponse.json({
      success: true,
      pet: updatedPet,
      message: 'Pet photo replaced successfully'
    })
  } catch (error) {
    console.error('[user-pets] PUT error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update pet'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
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
