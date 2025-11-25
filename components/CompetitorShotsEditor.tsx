'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, PlusCircle, Trash2, Save, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CompetitorShotForm,
  createEmptyShot,
  reindexShots
} from '@/lib/competitor-shot-form';

interface CompetitorShotsEditorProps {
  shots: CompetitorShotForm[];
  onShotsChange: (shots: CompetitorShotForm[]) => void;
  onSave: (shots: CompetitorShotForm[]) => Promise<void> | void;
  isSaving?: boolean;
  title?: string;
  description?: string;
  showSummary?: boolean;
}

export default function CompetitorShotsEditor({
  shots,
  onShotsChange,
  onSave,
  isSaving = false,
  title,
  description,
  showSummary = true
}: CompetitorShotsEditorProps) {
  const [expandedShots, setExpandedShots] = useState<Set<number>>(new Set());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const totalDuration = shots.reduce((sum, shot) => sum + (Number(shot.duration_seconds) || 0), 0);

  const toggleShot = (shotId: number) => {
    setExpandedShots(prev => {
      const next = new Set(prev);
      if (next.has(shotId)) {
        next.delete(shotId);
      } else {
        next.add(shotId);
      }
      return next;
    });
  };

  const handleAddShot = () => {
    const nextId = shots.length + 1;
    const nextShots = [...shots, createEmptyShot(nextId)];
    onShotsChange(nextShots);
    setExpandedShots(prev => new Set([...prev, nextId]));
  };

  const handleRemoveShot = (shotId: number) => {
    const nextShots = reindexShots(shots.filter(shot => shot.shot_id !== shotId));
    onShotsChange(nextShots);
    setExpandedShots(prev => {
      const next = new Set(prev);
      next.delete(shotId);
      return next;
    });
  };

  const updateShot = <K extends keyof CompetitorShotForm>(shotId: number, key: K, value: CompetitorShotForm[K]) => {
    const nextShots = shots.map(shot => (shot.shot_id === shotId ? { ...shot, [key]: value } : shot));
    onShotsChange(nextShots);
  };

  const handleSave = async () => {
    try {
      await onSave(shots);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch (error) {
      console.error('Failed to save shots', error);
      setSaveStatus('error');
    }
  };

  const showHeader = Boolean(title || description);

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {title && <h4 className="text-sm font-semibold text-gray-900">{title}</h4>}
            {description && <p className="text-xs text-gray-600">{description}</p>}
          </div>
          {showSummary && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                Shots: {shots.length}
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 font-semibold text-purple-700">
                Total duration: {totalDuration}s
              </div>
            </div>
          )}
        </div>
      )}

      {shots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-600 mb-3">No shots available yet. You can create your own storyboard.</p>
          <button
            type="button"
            onClick={handleAddShot}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Shot
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {shots.map((shot) => {
            const isExpanded = expandedShots.has(shot.shot_id);
            return (
              <div key={shot.shot_id} className="rounded-lg border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleShot(shot.shot_id)}
                  className="flex w-full items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                      Shot {shot.shot_id}
                    </div>
                    <div className="text-xs text-gray-500">
                      {shot.start_time || '00:00'} – {shot.end_time || '00:00'}
                    </div>
                    <div className="text-xs font-medium text-gray-700">{shot.duration_seconds}s</div>
                    {shot.contains_brand && (
                      <span className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700">
                        Brand
                      </span>
                    )}
                    {shot.contains_product && (
                      <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-700">
                        Product
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{isExpanded ? 'Hide' : 'Edit'}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-gray-100 p-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <ShotInput
                        label="Start Time"
                        value={shot.start_time}
                        onChange={(value) => updateShot(shot.shot_id, 'start_time', value)}
                        placeholder="00:00"
                      />
                      <ShotInput
                        label="End Time"
                        value={shot.end_time}
                        onChange={(value) => updateShot(shot.shot_id, 'end_time', value)}
                        placeholder="00:08"
                      />
                      <ShotInput
                        label="Duration (s)"
                        type="number"
                        value={String(shot.duration_seconds)}
                        onChange={(value) => updateShot(shot.shot_id, 'duration_seconds', Number(value))}
                      />
                    </div>

                    <ShotTextarea
                      label="First Frame"
                      value={shot.first_frame_description}
                      onChange={(value) => updateShot(shot.shot_id, 'first_frame_description', value)}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ShotTextarea
                        label="Subject"
                        value={shot.subject}
                        onChange={(value) => updateShot(shot.shot_id, 'subject', value)}
                      />
                      <ShotTextarea
                        label="Context / Environment"
                        value={shot.context_environment}
                        onChange={(value) => updateShot(shot.shot_id, 'context_environment', value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ShotTextarea
                        label="Action"
                        value={shot.action}
                        onChange={(value) => updateShot(shot.shot_id, 'action', value)}
                      />
                      <ShotTextarea
                        label="Style"
                        value={shot.style}
                        onChange={(value) => updateShot(shot.shot_id, 'style', value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ShotTextarea
                        label="Camera Motion"
                        value={shot.camera_motion_positioning}
                        onChange={(value) => updateShot(shot.shot_id, 'camera_motion_positioning', value)}
                      />
                      <ShotTextarea
                        label="Composition"
                        value={shot.composition}
                        onChange={(value) => updateShot(shot.shot_id, 'composition', value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ShotTextarea
                        label="Lighting / Ambiance"
                        value={shot.ambiance_colour_lighting}
                        onChange={(value) => updateShot(shot.shot_id, 'ambiance_colour_lighting', value)}
                      />
                      <ShotTextarea
                        label="Audio"
                        value={shot.audio}
                        onChange={(value) => updateShot(shot.shot_id, 'audio', value)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(shot.contains_brand)}
                            onChange={(e) => updateShot(shot.shot_id, 'contains_brand', e.target.checked)}
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          Contains brand elements
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(shot.contains_product)}
                            onChange={(e) => updateShot(shot.shot_id, 'contains_product', e.target.checked)}
                            className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          />
                          Contains product
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveShot(shot.shot_id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {shots.length > 0 && (
          <button
            type="button"
            onClick={handleAddShot}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Shot
          </button>
        )}

        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Shots saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="inline-flex items-center gap-1 text-sm text-red-600">
              <AlertTriangle className="w-4 h-4" />
              Failed to save shots
            </span>
          )}
          <button
            type="button"
            disabled={isSaving || shots.length === 0}
            onClick={handleSave}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
              isSaving || shots.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gray-900 hover:bg-gray-800'
            )}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Shots'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ShotInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}

function ShotInput({ label, value, onChange, placeholder, type = 'text' }: ShotInputProps) {
  return (
    <label className="block text-xs font-medium text-gray-700">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
      />
    </label>
  );
}

interface ShotTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  highlight?: boolean;
}

function ShotTextarea({ label, value, onChange, highlight = false }: ShotTextareaProps) {
  return (
    <label className="block text-xs font-medium text-gray-700">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2',
          highlight
            ? 'border-orange-200 bg-orange-50 focus:border-orange-400 focus:ring-orange-200'
            : 'border-gray-300 bg-white focus:border-gray-900 focus:ring-gray-900/20'
        )}
        rows={3}
      />
    </label>
  );
}
