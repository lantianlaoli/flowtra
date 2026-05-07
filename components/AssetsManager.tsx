'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Package, ExternalLink, Plus, UserCircle, Video } from 'lucide-react';
import { UserProduct, UserAvatar } from '@/lib/supabase';
import type { SystemAvatar } from '@/lib/default-avatars';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/providers/I18nProvider';
import ProductCard from './ProductCard';
import EditProductModal from './EditProductModal';
import CreateProductModal from './CreateProductModal';
import CreateAvatarModal from './CreateAvatarModal';
import EditAvatarModal from './EditAvatarModal';
import AvatarCard from './AvatarCard';
import SystemAvatarDetailsModal from './SystemAvatarDetailsModal';
import SystemProductDetailsModal from './SystemProductDetailsModal';
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
  source_type?: 'creator' | 'reference_video';
  reference_video_id?: string | null;
  isSystem?: boolean;
}

interface AssetsData {
  products: UserProduct[];
  creatorSources: CreatorSource[];
  videos: VideoAsset[];
  stats: {
    totalProducts: number;
    totalCreatorSources?: number;
    totalCreatorVideos?: number;
  };
}

const dedupeVideoAssets = (videos: VideoAsset[]): VideoAsset[] => {
  const uniqueVideos = new Map<string, VideoAsset>();

  videos.forEach((video) => {
    if (!video?.id) return;
    if (!uniqueVideos.has(video.id)) {
      uniqueVideos.set(video.id, video);
      return;
    }

    const existing = uniqueVideos.get(video.id)!;
    const existingUpdatedAt = existing.updated_at || existing.created_at || '';
    const nextUpdatedAt = video.updated_at || video.created_at || '';

    if (nextUpdatedAt >= existingUpdatedAt) {
      uniqueVideos.set(video.id, {
        ...existing,
        ...video,
      });
    }
  });

  return Array.from(uniqueVideos.values());
};

export default function AssetsManager() {
  const { messages } = useI18n();
  const assetsMessages = messages.dashboard.assets;
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const [assetsData, setAssetsData] = useState<AssetsData>({
    creatorSources: [],
    products: [],
    videos: [],
    stats: { totalProducts: 0, totalCreatorSources: 0, totalCreatorVideos: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingAvatarId, setDeletingAvatarId] = useState<string | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  // Avatar state
  type AvatarItem = UserAvatar | SystemAvatar;
  const [avatars, setAvatars] = useState<AvatarItem[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'avatars' | 'videos'>('products');

  // Modal states
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showCreateAvatarModal, setShowCreateAvatarModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<UserProduct | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<UserAvatar | null>(null);
  const [systemAvatarDetails, setSystemAvatarDetails] = useState<SystemAvatar | null>(null);
  const [systemProductDetails, setSystemProductDetails] = useState<UserProduct | null>(null);
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
        const dedupedVideos = dedupeVideoAssets(data.videos || []);
        setAssetsData({
          ...data,
          creatorSources: data.creatorSources || [],
          products: data.products || [],
          videos: dedupedVideos,
          stats: {
            totalProducts: data.stats?.totalProducts || 0,
            totalCreatorSources: data.stats?.totalCreatorSources || 0,
            totalCreatorVideos: dedupedVideos.length
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
    if (product.isSystem) {
      setSystemProductDetails(product);
      return;
    }
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
    const targetProduct = assetsData.products.find((item) => item.id === productId);
    if (targetProduct?.isSystem) {
      showError('System products cannot be deleted', 4000);
      return;
    }

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
    const targetProduct = assetsData.products.find((item) => item.id === productId);
    if (targetProduct?.isSystem) {
      showError('System products cannot be edited', 4000);
      return;
    }

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
    const targetProduct = assetsData.products.find((item) => item.id === productId);
    if (targetProduct?.isSystem) {
      showError('System products cannot be edited', 4000);
      return;
    }

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
    if ('user_id' in avatar) {
      setEditingAvatar(avatar);
      return;
    }

    setSystemAvatarDetails(avatar);
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
      const dedupedNewVideos = dedupeVideoAssets(newVideos);
      setAssetsData(prev => {
        const nextVideos = dedupeVideoAssets([...dedupedNewVideos, ...prev.videos]);
        return {
          ...prev,
          videos: nextVideos,
          stats: {
            ...prev.stats,
            totalCreatorVideos: nextVideos.length
          }
        };
      });
    }
    showSuccess(options?.message || 'Videos imported successfully');
    if (!options?.skipRefresh) {
      void loadAssets();
    }
  };

  const handleVideoDeleted = (videoId: string) => {
    setAssetsData((prev) => {
      const nextVideos = prev.videos.filter((video) => video.id !== videoId);

      return {
        ...prev,
        videos: nextVideos,
        stats: {
          ...prev.stats,
          totalCreatorVideos: nextVideos.length,
        },
      };
    });

    setSelectedVideo((current) => (current?.id === videoId ? null : current));
  };

  const handleVideoUpdated = (updatedVideo: VideoAsset) => {
    setAssetsData((prev) => {
      const nextVideos = dedupeVideoAssets(
        prev.videos.map((video) => (video.id === updatedVideo.id ? { ...video, ...updatedVideo } : video)),
      );

      return {
        ...prev,
        videos: nextVideos,
        stats: {
          ...prev.stats,
          totalCreatorVideos: nextVideos.length,
        },
      };
    });

    setSelectedVideo((current) => (
      current?.id === updatedVideo.id ? { ...current, ...updatedVideo } : current
    ));
  };

  const handleContinueVideoInAgentFeatures = () => {
    setShowVideoDetails(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('project_agent_open_feature_toolbar', '1');
    }
    router.push('/dashboard/agent');
  };

  const handleDeleteVideo = async (video: VideoAsset) => {
    if (video.isSystem) {
      showError('System videos cannot be deleted', 4000);
      return;
    }

    if (deletingVideoId) {
      return;
    }

    const isReferenceVideo =
      video.source_type === 'reference_video' || Boolean(video.reference_video_id);
    const endpoint = isReferenceVideo
      ? `/api/reference-videos/${video.id}`
      : `/api/creator-videos/${video.id}`;

    try {
      setDeletingVideoId(video.id);

      const response = await fetch(endpoint, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 404) {
        handleVideoDeleted(video.id);
        showSuccess('Video was already removed');
        return;
      }

      if (!response.ok) {
        showError((payload as { error?: string }).error || 'Failed to delete video');
        return;
      }

      handleVideoDeleted(video.id);
      showSuccess('Video deleted successfully');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete video';
      showError(message);
    } finally {
      setDeletingVideoId(null);
    }
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
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
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
            <span>{assetsMessages.tabs.products}</span>
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
            <span>{assetsMessages.tabs.avatars}</span>
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
            <span>{assetsMessages.tabs.videos}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="assets-content space-y-6">
        {activeTab === 'products' ? (
          <>
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
                />
              ))}

              <button
                type="button"
                onClick={() => setShowCreateProductModal(true)}
                className="assets-library-upload-card group relative flex w-full flex-col overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white text-left transition-all duration-200"
              >
                <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-4 bg-[#fcfcfc] px-4 text-center">
                  <div className="flex h-18 w-18 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors group-hover:border-gray-300 group-hover:text-black">
                    <Plus className="h-7 w-7" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 transition-colors group-hover:text-black">
                    {assetsMessages.actions.upload}
                  </span>
                </div>
              </button>
            </div>
          </>
        ) : activeTab === 'avatars' ? (
          <>
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

              <button
                type="button"
                onClick={() => setShowCreateAvatarModal(true)}
                className="assets-library-upload-card group relative flex w-full flex-col overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white text-left transition-all duration-200"
              >
                <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-4 bg-[#fcfcfc] px-4 text-center">
                  <div className="flex h-18 w-18 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-colors group-hover:border-gray-300 group-hover:text-black">
                    <Plus className="h-7 w-7" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 transition-colors group-hover:text-black">
                    {assetsMessages.actions.upload}
                  </span>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Actions & Search */}
            <div className="assets-actions flex flex-col lg:flex-row gap-4 justify-between items-center">
              <div className="assets-search relative w-full lg:max-w-md">
                <Search className="assets-search-icon w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={assetsMessages.search.videos}
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
                  <span className="hidden sm:inline">{assetsMessages.actions.downloadViralVideos}</span>
                  <span className="sm:hidden">{assetsMessages.tabs.videos}</span>
                </a>
                <button
                  onClick={() => setShowVideoImportModal(true)}
                  className="assets-primary-button flex-1 lg:flex-none flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <Video className="w-4 h-4" />
                  {assetsMessages.actions.importVideos}
                </button>
              </div>
            </div>

            {/* Videos Grid */}
            {filteredVideos.length === 0 && normalizedSearch ? (
              <div className="assets-empty py-12 text-center">
                <Search className="assets-empty-icon w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="assets-empty-title text-lg font-medium text-gray-900 mb-2">{assetsMessages.empty.noResults}</h3>
                <p className="assets-empty-copy text-gray-500">{assetsMessages.empty.adjustSearch}</p>
              </div>
            ) : filteredVideos.length > 0 ? (
              <div className="assets-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredVideos.map((video) => (
                  <VideoAssetCard
                    key={video.id}
                    video={video}
                    isDeleting={deletingVideoId === video.id}
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
                <h3 className="assets-empty-title text-lg font-medium text-gray-900 mb-2">{assetsMessages.empty.noVideosTitle}</h3>
                <p className="assets-empty-copy text-gray-500 mb-6">{assetsMessages.empty.noVideosDescription}</p>
                <button
                  onClick={() => setShowVideoImportModal(true)}
                  className="assets-primary-button inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Video className="w-4 h-4" />
                  {assetsMessages.actions.importVideos}
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
      <SystemAvatarDetailsModal
        isOpen={!!systemAvatarDetails}
        avatar={systemAvatarDetails}
        onClose={() => setSystemAvatarDetails(null)}
      />
      <SystemProductDetailsModal
        isOpen={!!systemProductDetails}
        product={systemProductDetails}
        onClose={() => setSystemProductDetails(null)}
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
        onDeleteVideo={handleDeleteVideo}
        onVideoUpdated={handleVideoUpdated}
        onContinueInAgentFeatures={handleContinueVideoInAgentFeatures}
      />
    </div>
  );
}
