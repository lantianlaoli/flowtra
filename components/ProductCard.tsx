'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, Plus, X } from 'lucide-react';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductCardProps {
  product: UserProduct;
  onEdit: (productId: string, newName: string) => void;
  onDelete: (productId: string) => void;
  onPhotoUpload: (productId: string, file: File) => void;
  onDeletePhoto: (productId: string, photoId: string) => void;
  onSelect?: (product: UserProduct) => void;
  isSelected?: boolean;
  selectable?: boolean;
}

export default function ProductCard({
  product,
  onEdit,
  onDelete,
  onPhotoUpload,
  onDeletePhoto,
  onSelect,
  isSelected = false,
  selectable = false
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const photos = product.user_product_photos || [];

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${product.product_name}"? This action cannot be undone.`)) {
      onDelete(product.id);
    }
  };

  const handlePhotoDelete = (photo: UserProductPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this photo?')) {
      onDeletePhoto(product.id, photo.id);
    }
  };

  const handleSelect = () => {
    if (selectable && onSelect) {
      onSelect(product);
    }
  };

  const handleStartEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setEditingName(product.product_name);
  };

  const handleSaveEdit = async () => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      setEditingName(product.product_name);
      setIsEditing(false);
      return;
    }

    // Exit editing mode immediately for better UX
    setIsEditing(false);

    if (trimmedName !== product.product_name) {
      // Call the parent handler to update the API and state
      onEdit(product.id, trimmedName);
    }
  };

  const handleCancelEdit = () => {
    setEditingName(product.product_name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onPhotoUpload(product.id, file);
    }
    // Reset input so same file can be selected again if needed
    if (e.target) e.target.value = '';
  };

  return (
    <motion.div
      className={`
        bg-white rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${selectable
          ? isSelected
            ? 'border-gray-900 shadow-lg ring-2 ring-gray-200'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
          : 'border-gray-200 hover:shadow-md'
        }
      `}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleSelect}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={handleKeyDown}
                className="font-semibold text-gray-900 text-lg mb-1 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-gray-900 focus:border-transparent w-full"
                autoFocus
                onFocus={(e) => e.target.select()}
                maxLength={100}
              />
            ) : (
              <h3
                className="font-semibold text-gray-900 text-lg mb-1 cursor-pointer hover:text-gray-700 transition-colors"
                onClick={handleStartEditing}
              >
                {product.product_name}
              </h3>
            )}
            {product.description && (
              <p className="text-gray-600 text-sm line-clamp-2">
                {product.description}
              </p>
            )}
          </div>

          {!selectable && (
            <div className="flex gap-2 ml-3">
              <button
                onClick={handleStartEditing}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Name</span>
              </button>
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Photos Grid */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {photos.slice(0, 5).map((photo) => (
            <div key={photo.id} className="relative group aspect-square">
              <Image
                src={photo.photo_url}
                alt={photo.file_name}
                fill
                className="object-cover rounded-lg"
                sizes="(max-width: 768px) 33vw, 20vw"
              />
              {!selectable && (
                <button
                  onClick={(e) => handlePhotoDelete(photo, e)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          {/* Add Photo Button */}
          {!selectable && photos.length < 6 && (
            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors group cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                onClick={(e) => e.stopPropagation()}
              />
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
            </label>
          )}

          {/* Show more indicator */}
          {photos.length > 5 && (
            <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                +{photos.length - 5}
              </span>
            </div>
          )}
        </div>

        {photos.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-lg flex items-center justify-center">
              <Plus className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm">No photos yet</p>
            {!selectable && (
              <label className="mt-2 text-sm text-gray-900 hover:underline cursor-pointer inline-block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                />
                Add photos
              </label>
            )}
          </div>
        )}
      </div>

    </motion.div>
  );
}