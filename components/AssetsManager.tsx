'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, Loader2, Package, ExternalLink, UserCircle, Video } from 'lucide-react';
import { UserBrand, UserProduct, UserAvatar } from '@/lib/supabase';
import type { SystemAvatar } from '@/lib/default-avatars';
import { useToast } from '@/contexts/ToastContext';
import ProductCard from './ProductCard';
import EditProductModal from './EditProductModal';
import CreateProductModal from './CreateProductModal';
import CreateAvatarModal from './CreateAvatarModal';
import EditAvatarModal from './EditAvatarModal';
import AvatarCard from './AvatarCard';
import VideoImportModal from './VideoImportModal';
import VideoAssetCard from './VideoAssetCard';
import VideoAssetDetailsModal from './VideoAssetDetailsModal';

interface CreatorSourceVideo {
  id: string;
  platform?: string;
  video_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  video_cdn_url?: string | null;
  analysis_status?: string | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_error?: string | null;
  analysis_language?: string | null;
  stats?: Record<string, unknown> | null;
  platform_video_id?: string;
  source_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CreatorSource {
  id: string;
  source_name: string;
  creator_source_videos?: CreatorSourceVideo[];
}

interface VideoAsset extends CreatorSourceVideo {
  source_name?: string | null;
  source_type?: 'creator' | 'competitor_ad';
  competitor_ad_id?: string | null;
}

interface AssetsData {
  brands: UserBrand[];
  products: (UserProduct & { brand?: UserBrand | null })[];
  creatorSources: CreatorSource[];
  videos: VideoAsset[];
  stats: {
    totalBrands: number;
    totalProducts: number;
    totalCreatorSources?: number;
    totalCreatorVideos?: number;
  };
}

export default function AssetsManager() {
  const { showSuccess, showError } = useToast();
  const [assetsData, setAssetsData] = useState<AssetsData>({
    brands: [],
    creatorSources: [],
    products: [],
    videos: [],
    stats: { totalBrands: 0, totalProducts: 0, totalCreatorSources: 0, totalCreatorVideos: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingAvatarId, setDeletingAvatarId] = useState<string | null>(null);

  // Avatar state
  type AvatarItem = UserAvatar | SystemAvatar;
  const [avatars, setAvatars] = useState<AvatarItem[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'avatars' | 'videos'>('products');

  // Modal states
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showCreateAvatarModal, setShowCreateAvatarModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<UserProduct | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<UserAvatar | null>(null);
  const [showVideoImportModal, setShowVideoImportModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(null);
  const [showVideoDetails, setShowVideoDetails] = useState(false);

  useEffect(() => {
    loadAssets();
    loadAvatars();
  }, []);

  useEffect(() => {
    if (!editingProduct) return;
    const latest = assetsData.products.find((product) => product.id === editingProduct.id);
    if (latest) {
      setEditingProduct(latest);
    }
  }, [assetsData.products, editingProduct]);

  const loadAssets = async () => {
    try {
      const response = await fetch('/api/assets', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setAssetsData({
          ...data,
          creatorSources: data.creatorSources || [],
          products: data.products || [],
          videos: data.videos || [],
          stats: {
            totalBrands: data.stats?.totalBrands || 0,
            totalProducts: data.stats?.totalProducts || 0,
            totalCreatorSources: data.stats?.totalCreatorSources || 0,
            totalCreatorVideos: data.stats?.totalCreatorVideos || 0
          }
        });
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvatars = async () => {
    try {
      const response = await fetch('/api/user-avatars', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error('Error loading avatars:', error);
    }
  };

  // Product handlers
  const handleProductCreated = (newProduct: UserProduct) => {
    setAssetsData(prev => ({
      ...prev,
      products: [newProduct, ...prev.products],
      stats: {
        ...prev.stats,
        totalProducts: prev.stats.totalProducts + 1
      }
    }));

    void loadAssets();
  };

  const handleEditProduct = (product: UserProduct) => {
    setEditingProduct(product);
  };

  const handleProductUpdated = (updatedProduct: UserProduct) => {
    setAssetsData(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === updatedProduct.id ? updatedProduct : p
      )
    }));
    showSuccess('Product updated successfully');
  };

  const handleDeleteProduct = async (productId: string) => {
    if (deletingProductId) {
      return; // Prevent multiple simultaneous deletes
    }

    try {
      setDeletingProductId(productId);

      const response = await fetch(`/api/user-products/${productId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
        setAssetsData(prev => ({
          ...prev,
          products: prev.products.filter(p => p.id !== productId),
          stats: {
            ...prev.stats,
            totalProducts: Math.max(prev.stats.totalProducts - 1, 0)
          }
        }));

        // Show success message with affected projects count
        const affectedCount = data.affectedProjects || 0;
        if (affectedCount > 0) {
          showSuccess(
            `Product deleted. ${affectedCount} project(s) have been automatically unlinked.`,
            5000
          );
        } else {
          showSuccess('Product deleted successfully', 3000);
        }
      } else {
        // Handle error response
        const errorMessage = data.message || data.error || 'Failed to delete product';
        console.error('Error deleting product:', data);
        showError(errorMessage, 5000);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      showError(
        'An error occurred while deleting the product. Please try again.',
        5000
      );
    } finally {
      setDeletingProductId(null);
    }
  };

  const handlePhotoUpload = async (
    productId: string,
    file: File,
    photoRole: 'frontal' | 'reference' = 'reference'
  ) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('photo_role', photoRole);

      const response = await fetch(`/api/user-products/${productId}/photos`, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showError(payload?.error || payload?.details || 'Failed to upload image', 5000);
        return;
      }

      showSuccess(photoRole === 'frontal' ? 'Frontal image uploaded successfully' : 'Reference image uploaded successfully');
      await loadAssets();
    } catch (error) {
      console.error('Error uploading photo:', error);
      showError('An error occurred while uploading the image. Please try again.', 5000);
    }
  };

  const handleDeletePhoto = async (productId: string, photoId: string) => {
    try {
      const response = await fetch(`/api/user-products/${productId}/photos?photoId=${photoId}`, {
        method: 'DELETE'
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        showError(payload?.error || payload?.details || 'Failed to delete photo', 5000);
        return;
      }

      showSuccess('Photo deleted successfully');
      await loadAssets();
    } catch (error) {
      console.error('Error deleting photo:', error);
      showError('An error occurred while deleting the photo. Please try again.', 5000);
    }
  };


  // Avatar handlers
  const handleAvatarCreated = (newAvatar: UserAvatar) => {
    setAvatars(prev => [newAvatar, ...prev]);
    showSuccess('Avatar created successfully');
  };

  const handleAvatarUpdated = (updatedAvatar: UserAvatar) => {
    setAvatars(prev => prev.map(a => a.id === updatedAvatar.id ? updatedAvatar : a));
    showSuccess('Avatar updated successfully');
  };

  const handleEditAvatar = (avatar: AvatarItem) => {
    if (!('user_id' in avatar)) return;
    setEditingAvatar(avatar);
  };

  const handleDeleteAvatar = async (avatarId: string) => {
    if (deletingAvatarId) {
      return; // Prevent multiple simultaneous deletes
    }

    try {
      setDeletingAvatarId(avatarId);

      const response = await fetch(`/api/user-avatars?avatarId=${avatarId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAvatars(prev => prev.filter(a => a.id !== avatarId));
        showSuccess('Avatar deleted successfully');
      } else {
        const data = await response.json();
        const errorMessage = data.message || data.error || 'Failed to delete avatar';
        console.error('Error deleting avatar:', data);
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
      showError('An error occurred while deleting the avatar. Please try again.');
    } finally {
      setDeletingAvatarId(null);
    }
  };

  const handleVideosImported = (
    newVideos: VideoAsset[],
    options?: { message?: string; skipRefresh?: boolean }
  ) => {
    if (newVideos.length > 0) {
      setAssetsData(prev => ({
        ...prev,
        videos: [...newVideos, ...prev.videos],
        stats: {
          ...prev.stats,
          totalCreatorVideos: (prev.stats.totalCreatorVideos || 0) + newVideos.length
        }
      }));
    }
    showSuccess(options?.message || 'Videos imported successfully');
    if (!options?.skipRefresh) {
      void loadAssets();
    }
  };

  const handleVideoDeleted = (videoId: string) => {
    setAssetsData((prev) => ({
      ...prev,
      videos: prev.videos.filter((video) => video.id !== videoId),
      stats: {
        ...prev.stats,
        totalCreatorVideos: Math.max((prev.stats.totalCreatorVideos || 0) - 1, 0),
      },
    }));

    setSelectedVideo((current) => (current?.id === videoId ? null : current));
  };

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const filteredProducts = useMemo(() => {
    return assetsData.products.filter(product => {
      const matchesSearch = !normalizedSearch
        || product.product_name.toLowerCase().includes(normalizedSearch);

      return matchesSearch;
    });
  }, [assetsData.products, normalizedSearch]);

  const filteredAvatars = useMemo(() => {
    return avatars.filter(avatar =>
      avatar.avatar_name.toLowerCase().includes(normalizedSearch)
    );
  }, [avatars, normalizedSearch]);

  const filteredVideos = useMemo(() => {
    const filtered = assetsData.videos.filter(video => {
      const matchesSearch = !normalizedSearch
        || video.description?.toLowerCase().includes(normalizedSearch)
        || video.source_name?.toLowerCase().includes(normalizedSearch);

      return matchesSearch;
    });

    return filtered.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [assetsData.videos, normalizedSearch]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="assets-manager space-y-6">
      {/* Tab Switcher */}
      <div className="assets-tabs border-b border-gray-200">
        <div className="assets-tabs-list flex gap-8">
          <button
            onClick={() => setActiveTab('products')}
            className={`
              assets-tab flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'products'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Package className="w-4 h-4" />
            <span>Products</span>
          </button>
          <button
            onClick={() => setActiveTab('avatars')}
            className={`
              assets-tab flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'avatars'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <UserCircle className="w-4 h-4" />
            <span>Avatars</span>
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`
              assets-tab flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'videos'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Video className="w-4 h-4" />
            <span>Videos</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="assets-content space-y-6">
        {activeTab === 'products' ? (
          <>
            {/* Actions & Search */}
            <div className="assets-actions flex flex-col lg:flex-row gap-4 justify-between items-center">
              <div className="assets-search relative w-full lg:max-w-md">
                <Search className="assets-search-icon w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="assets-search-input w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
              </div>
              <div className="assets-actions-buttons flex gap-3 w-full lg:w-auto">
                <button
                  onClick={() => setShowCreateProductModal(true)}
                  className="assets-primary-button flex-1 lg:flex-none flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <Package className="w-4 h-4" />
                  New Product
                </button>
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 && normalizedSearch ? (
              <div className="assets-empty py-12 text-center">
                <Search className="assets-empty-icon w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="assets-empty-title text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="assets-empty-copy text-gray-500">Try adjusting your search terms</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="assets-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onView={handleEditProduct}
                    onEditClick={handleEditProduct}
                    onDelete={handleDeleteProduct}
                    onPhotoUpload={handlePhotoUpload}
                    isDeleting={deletingProductId === product.id}
                    mode="compact"
                    brandLabel={undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="assets-empty py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <Package className="assets-empty-icon w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="assets-empty-title text-lg font-medium text-gray-900 mb-2">No products yet</h3>
                <p className="assets-empty-copy text-gray-500 mb-6">
                  Create your first product to start generating videos faster.
                </p>
                <button
                  onClick={() => setShowCreateProductModal(true)}
                  className="assets-primary-button inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Package className="w-4 h-4" />
                  Add Product
                </button>
              </div>
            )}
          </>
        ) : activeTab === 'avatars' ? (
          <>
            {/* Actions & Search */}
            <div className="assets-actions flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="assets-search relative w-full md:max-w-md">
                <Search className="assets-search-icon w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search avatars..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="assets-search-input w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
              </div>
              <div className="assets-actions-buttons w-full md:w-auto">
                <button
                  onClick={() => setShowCreateAvatarModal(true)}
                  className="assets-primary-button w-full md:w-auto flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <UserCircle className="w-4 h-4" />
                  Add Avatar
                </button>
              </div>
            </div>

            {/* Avatars Tab */}
            {filteredAvatars.length === 0 && searchTerm ? (
              <div className="assets-empty py-12 text-center">
                <Search className="assets-empty-icon w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="assets-empty-title text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="assets-empty-copy text-gray-500">Try adjusting your search terms</p>
              </div>
            ) : (
              <>
                {filteredAvatars.length > 0 ? (
                  <div className="assets-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredAvatars.map((avatar) => (
                      <AvatarCard
                        key={avatar.id}
                        avatar={avatar}
                        onEdit={handleEditAvatar}
                        onDelete={handleDeleteAvatar}
                        isDeleting={deletingAvatarId === avatar.id}
                        mode="full"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="assets-empty text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <UserCircle className="assets-empty-icon w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p className="assets-empty-copy text-gray-500">
                      {searchTerm ? 'No avatars match your search' : 'No avatars yet. Add your first avatar to use in video generation.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Actions & Search */}
            <div className="assets-actions flex flex-col lg:flex-row gap-4 justify-between items-center">
              <div className="assets-search relative w-full lg:max-w-md">
                <Search className="assets-search-icon w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search videos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="assets-search-input w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
              </div>
              <div className="assets-actions-buttons flex gap-3 w-full lg:w-auto">
                <a
                  href="https://www.flowtra.store/blog/free-ugc-download-methods-2025"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="assets-secondary-button flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Download Viral Videos</span>
                  <span className="sm:hidden">Videos</span>
                </a>
                <button
                  onClick={() => setShowVideoImportModal(true)}
                  className="assets-primary-button flex-1 lg:flex-none flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <Video className="w-4 h-4" />
                  Import Videos
                </button>
              </div>
            </div>

            {/* Videos Grid */}
            {filteredVideos.length === 0 && normalizedSearch ? (
              <div className="assets-empty py-12 text-center">
                <Search className="assets-empty-icon w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="assets-empty-title text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="assets-empty-copy text-gray-500">Try adjusting your search terms</p>
              </div>
            ) : filteredVideos.length > 0 ? (
              <div className="assets-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredVideos.map((video) => (
                  <VideoAssetCard
                    key={video.id}
                    video={video}
                    onViewDetails={(asset) => {
                      setSelectedVideo(asset);
                      setShowVideoDetails(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="assets-empty py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <Video className="assets-empty-icon w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="assets-empty-title text-lg font-medium text-gray-900 mb-2">No videos yet</h3>
                <p className="assets-empty-copy text-gray-500 mb-6">Import TikTok videos to reuse them across projects.</p>
                <button
                  onClick={() => setShowVideoImportModal(true)}
                  className="assets-primary-button inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Video className="w-4 h-4" />
                  Import Videos
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <EditProductModal
        isOpen={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onProductUpdated={handleProductUpdated}
        onDelete={handleDeleteProduct}
        onPhotoUpload={handlePhotoUpload}
        onDeletePhoto={handleDeletePhoto}
        isDeleting={deletingProductId === editingProduct?.id}
      />

      <CreateProductModal
        isOpen={showCreateProductModal}
        onClose={() => {
          setShowCreateProductModal(false);
        }}
        onProductCreated={handleProductCreated}
        preselectedBrandId={null}
      />

      <CreateAvatarModal
        isOpen={showCreateAvatarModal}
        onClose={() => setShowCreateAvatarModal(false)}
        onAvatarCreated={handleAvatarCreated}
      />

      <EditAvatarModal
        isOpen={!!editingAvatar}
        avatar={editingAvatar}
        onClose={() => setEditingAvatar(null)}
        onAvatarUpdated={handleAvatarUpdated}
        onDelete={handleDeleteAvatar}
        isDeleting={deletingAvatarId === editingAvatar?.id}
      />
      <VideoImportModal
        isOpen={showVideoImportModal}
        onClose={() => setShowVideoImportModal(false)}
        onImported={handleVideosImported}
        onError={(error) => showError(error)}
      />
      <VideoAssetDetailsModal
        isOpen={showVideoDetails}
        onClose={() => setShowVideoDetails(false)}
        video={selectedVideo}
        onVideoDeleted={handleVideoDeleted}
      />
    </div>
  );
}
