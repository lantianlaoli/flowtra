'use client';

import Image from 'next/image';
import { PawPrint, Trash2 } from 'lucide-react';
import type { UserPet } from '@/lib/supabase';

export default function PetCard({
  pet,
  onDelete,
  isDeleting,
}: {
  pet: UserPet;
  onDelete: (petId: string) => void;
  isDeleting?: boolean;
}) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-gray-300 hover:shadow-sm">
      <div className="grid aspect-[4/5] grid-cols-2 gap-1 bg-[#fcfcfc] p-2">
        <div className="col-span-2 overflow-hidden rounded-lg border border-gray-100 bg-white">
          <Image src={pet.front_photo_url} alt={`${pet.pet_name} front`} width={360} height={240} className="h-full w-full object-cover" unoptimized />
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
          <Image src={pet.side_photo_url} alt={`${pet.pet_name} side`} width={180} height={160} className="h-full w-full object-cover" unoptimized />
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
          <Image src={pet.back_photo_url} alt={`${pet.pet_name} back`} width={180} height={160} className="h-full w-full object-cover" unoptimized />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{pet.pet_name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
            <PawPrint className="h-3.5 w-3.5" />
            3 reference views
          </p>
        </div>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => onDelete(pet.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          aria-label="Delete pet"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
