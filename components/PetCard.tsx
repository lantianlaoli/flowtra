'use client';

import Image from 'next/image';
import type React from 'react';
import { Eye, Trash2 } from 'lucide-react';
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
    <article className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-gray-300 hover:shadow-sm">
      <button
        type="button"
        className="block w-full text-left"
        disabled={!onEdit || isDeleting}
        onClick={handleEdit}
        aria-label={`View details for ${pet.pet_name}`}
      >
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
      </button>
      <div className="flex flex-col gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{pet.pet_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!onEdit || isDeleting}
            onClick={handleEdit}
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border border-black bg-black px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 disabled:cursor-not-allowed disabled:opacity-50"
            title="View details"
          >
            <Eye className="h-4 w-4" />
            <span>View Details</span>
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDelete}
            className="flex min-h-[42px] w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Delete pet"
            title="Delete pet"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
