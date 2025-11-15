'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, Loader2 } from 'lucide-react';
import { CompetitorAd } from '@/lib/supabase';
import CompetitorAdCard from './CompetitorAdCard';
import CreateCompetitorAdModal from './CreateCompetitorAdModal';
import EditCompetitorAdModal from './EditCompetitorAdModal';

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
    setCompetitorAds(prev => [newCompetitorAd, ...prev]);
  };

  const handleCompetitorAdUpdated = (updatedCompetitorAd: CompetitorAd) => {
    setCompetitorAds(prev =>
      prev.map(ad => ad.id === updatedCompetitorAd.id ? updatedCompetitorAd : ad)
    );
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return; // Prevent multiple deletes

    const confirmed = confirm('Are you sure you want to delete this competitor ad? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setDeletingId(id);
      const response = await fetch(`/api/competitor-ads/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCompetitorAds(prev => prev.filter(ad => ad.id !== id));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete competitor ad');
      }
    } catch (error) {
      console.error('Error deleting competitor ad:', error);
      alert('An error occurred while deleting the competitor ad');
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Competitor Ads ({competitorAds.length})
          </h3>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Competitor Ad
        </button>
      </div>

      {/* List */}
      {competitorAds.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <h4 className="text-base font-medium text-gray-900 mb-1">No competitor ads yet</h4>
          <p className="text-sm text-gray-600 mb-4">
            Add competitor ads to use as reference when generating your own advertisements
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Your First Competitor Ad
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
    </div>
  );
}
