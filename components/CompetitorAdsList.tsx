'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, Loader2 } from 'lucide-react';
import { CompetitorAd } from '@/lib/supabase';
import CompetitorAdCard from './CompetitorAdCard';
import CreateCompetitorAdModal from './CreateCompetitorAdModal';
import EditCompetitorAdModal from './EditCompetitorAdModal';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface CompetitorAdsListProps {
  brandId: string;
  brandName: string;
}

export default function CompetitorAdsList({ brandId, brandName }: CompetitorAdsListProps) {
  const [competitorAds, setCompetitorAds] = useState<CompetitorAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCompetitorAd, setEditingCompetitorAd] = useState<CompetitorAd | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ isOpen: boolean; id: string | null }>({
    isOpen: false,
    id: null
  });

  useEffect(() => {
    loadCompetitorAds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const loadCompetitorAds = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/competitor-ads?brandId=${brandId}`);
      if (response.ok) {
        const data = await response.json();
        setCompetitorAds(data.competitorAds || []);
      }
    } catch (error) {
      console.error('Error loading competitor ads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompetitorAdCreated = (newCompetitorAd: CompetitorAd) => {
    setCompetitorAds(prev => {
      // Prevent duplicate IDs (safety net against race conditions)
      const exists = prev.some(ad => ad.id === newCompetitorAd.id);
      if (exists) {
        console.warn('[CompetitorAdsList] Duplicate competitor ad prevented:', newCompetitorAd.id);
        return prev; // Don't add duplicate
      }
      return [newCompetitorAd, ...prev];
    });
  };

  const handleCompetitorAdUpdated = (updatedCompetitorAd: CompetitorAd) => {
    setCompetitorAds(prev =>
      prev.map(ad => ad.id === updatedCompetitorAd.id ? updatedCompetitorAd : ad)
    );
    setEditingCompetitorAd(current =>
      current && current.id === updatedCompetitorAd.id ? updatedCompetitorAd : current
    );
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmDialog({ isOpen: true, id });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmDialog.id || deletingId) return;

    const id = deleteConfirmDialog.id;

    try {
      setDeletingId(id);
      console.log(`[CompetitorAdsList] Deleting competitor ad: ${id}`);

      const response = await fetch(`/api/competitor-ads/${id}`, {
        method: 'DELETE'
      });

      console.log(`[CompetitorAdsList] Delete response status: ${response.status}`);

      if (response.ok) {
        setCompetitorAds(prev => prev.filter(ad => ad.id !== id));
        setDeleteConfirmDialog({ isOpen: false, id: null });
      } else {
        try {
          const data = await response.json();
          const errorMessage = data.error || data.details || 'Failed to delete competitor ad';
          console.error(`[CompetitorAdsList] Delete error: ${errorMessage}`, data);
          alert(errorMessage);
        } catch {
          alert('Failed to delete competitor ad. Please try again.');
        }
      }
    } catch (error) {
      console.error('[CompetitorAdsList] Delete network error:', error);
      alert('Network error: Unable to delete competitor ad. Please check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Viral Video
        </button>
      </div>

      {/* List */}
      {competitorAds.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <h4 className="text-base font-medium text-gray-900 mb-1">No viral videos yet</h4>
          <p className="text-sm text-gray-600 mb-4">
            Add viral videos to use as reference when generating your own advertisements
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Your First Viral Video
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {competitorAds.map((competitorAd) => (
            <CompetitorAdCard
              key={competitorAd.id}
              competitorAd={competitorAd}
              onEdit={setEditingCompetitorAd}
              onDelete={handleDelete}
              isDeleting={deletingId === competitorAd.id}
              mode="manage"
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateCompetitorAdModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        brandId={brandId}
        brandName={brandName}
        onCompetitorAdCreated={handleCompetitorAdCreated}
      />

      <EditCompetitorAdModal
        isOpen={!!editingCompetitorAd}
        onClose={() => setEditingCompetitorAd(null)}
        competitorAd={editingCompetitorAd}
        onCompetitorAdUpdated={handleCompetitorAdUpdated}
      />

      <ConfirmationDialog
        isOpen={deleteConfirmDialog.isOpen}
        title="Delete viral video?"
        description="Are you sure you want to delete this competitor ad? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
        isLoading={deletingId === deleteConfirmDialog.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmDialog({ isOpen: false, id: null })}
      />
    </div>
  );
}
