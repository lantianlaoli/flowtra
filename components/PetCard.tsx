'use client';

import Image from 'next/image';
import type React from 'react';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import type { UserPet } from '@/lib/supabase';

export default function PetCard({
  pet,
  onDelete,
  onEdit,
  isDeleting,
}: {
  pet: UserPet;
  onDelete: (petId: string) => void;
  onEdit?: (pet: UserPet) => void;
  isDeleting?: boolean;
}) {
  const handleEdit = () => {
    onEdit?.(pet);
  };

  const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isDeleting) return;
    onDelete(pet.id);
  };

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-gray-300 hover:shadow-sm">
      <button
        type="button"
        className="block w-full text-left"
        disabled={!onEdit || isDeleting}
        onClick={handleEdit}
        aria-label={`View details for ${pet.pet_name}`}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#fcfcfc]">
          <Image
            src={pet.front_photo_url}
            alt={pet.pet_name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        </div>
      </button>
      <div className="flex flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900">{pet.pet_name}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!onEdit || isDeleting}
            onClick={handleEdit}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-black bg-black px-3 text-xs font-semibold text-white transition hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:cursor-not-allowed disabled:opacity-50"
            title="Edit pet"
            aria-label="Edit pet"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Delete pet"
            title="Delete pet"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}
