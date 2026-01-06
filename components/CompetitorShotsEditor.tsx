'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  Eye, 
  User, 
  MapPin, 
  Play, 
  Sparkles, 
  Video, 
  Layout, 
  Sun, 
  Music,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CompetitorShotForm,
  createEmptyShot,
  reindexShots
} from '@/lib/competitor-shot-form';

interface CompetitorShotsEditorProps {
  shots: CompetitorShotForm[];
  onShotsChange: (shots: CompetitorShotForm[]) => void;
  title?: string;
  description?: string;
  showSummary?: boolean;
}

export default function CompetitorShotsEditor({
  shots,
  onShotsChange,
  title,
  description,
  showSummary = true
}: CompetitorShotsEditorProps) {
  const [expandedShots, setExpandedShots] = useState<Set<number>>(new Set());

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

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
        <div className="flex items-center gap-3">
          <h4 className="text-sm font-semibold text-black">Shot List</h4>
          {showSummary && (
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-full bg-[#F7F7F7] border border-[#E5E5E5] px-2 py-0.5 text-xs font-medium text-[#666666]">
                {shots.length} shots
              </span>
              <span className="inline-flex items-center rounded-full bg-[#F7F7F7] border border-[#E5E5E5] px-2 py-0.5 text-xs font-medium text-[#666666]">
                {totalDuration}s
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddShot}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-black hover:bg-gray-50 transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Shot
        </button>
      </div>

      {shots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-[#F7F7F7] p-8 text-center">
          <p className="text-sm text-[#666666] mb-4">No shots yet. Create a storyboard.</p>
          <button
            type="button"
            onClick={handleAddShot}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Shot
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {shots.map((shot) => {
            const isExpanded = expandedShots.has(shot.shot_id);
            return (
              <div key={shot.shot_id} className="rounded-xl border border-[#E5E5E5] bg-white overflow-hidden transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
                <div
                  onClick={() => toggleShot(shot.shot_id)}
                  className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#F7F7F7] transition-colors cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-md bg-black text-white px-2 py-1 text-xs font-bold">
                      #{shot.shot_id}
                    </div>
                    <div className="text-xs font-medium text-[#666666] font-mono">
                      {shot.start_time || '00:00'} - {shot.end_time || '00:00'}
                    </div>
                    <div className="text-xs font-semibold text-black">{shot.duration_seconds}s</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveShot(shot.shot_id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete shot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#666666]" /> : <ChevronDown className="w-4 h-4 text-[#666666]" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[#E5E5E5] p-4 space-y-4 bg-[#FAFAFA]">
                        <div className="grid grid-cols-3 gap-3">
                          <ShotInput
                            label="Start"
                            icon={<Clock className="w-3 h-3" />}
                            value={shot.start_time}
                            onChange={(value) => updateShot(shot.shot_id, 'start_time', value)}
                            placeholder="00:00"
                          />
                          <ShotInput
                            label="End"
                            icon={<Clock className="w-3 h-3" />}
                            value={shot.end_time}
                            onChange={(value) => updateShot(shot.shot_id, 'end_time', value)}
                            placeholder="00:08"
                          />
                          <ShotInput
                            label="Duration"
                            icon={<Clock className="w-3 h-3" />}
                            type="number"
                            value={String(shot.duration_seconds)}
                            onChange={(value) => updateShot(shot.shot_id, 'duration_seconds', Number(value))}
                          />
                        </div>

                        <ShotTextarea
                          label="Visual Description"
                          icon={<Eye className="w-3 h-3" />}
                          value={shot.first_frame_description}
                          onChange={(value) => updateShot(shot.shot_id, 'first_frame_description', value)}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ShotTextarea
                            label="Subject"
                            icon={<User className="w-3 h-3" />}
                            value={shot.subject}
                            onChange={(value) => updateShot(shot.shot_id, 'subject', value)}
                          />
                          <ShotTextarea
                            label="Environment"
                            icon={<MapPin className="w-3 h-3" />}
                            value={shot.context_environment}
                            onChange={(value) => updateShot(shot.shot_id, 'context_environment', value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ShotTextarea
                            label="Action"
                            icon={<Play className="w-3 h-3" />}
                            value={shot.action}
                            onChange={(value) => updateShot(shot.shot_id, 'action', value)}
                          />
                          <ShotTextarea
                            label="Style"
                            icon={<Sparkles className="w-3 h-3" />}
                            value={shot.style}
                            onChange={(value) => updateShot(shot.shot_id, 'style', value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ShotTextarea
                            label="Camera"
                            icon={<Video className="w-3 h-3" />}
                            value={shot.camera_motion_positioning}
                            onChange={(value) => updateShot(shot.shot_id, 'camera_motion_positioning', value)}
                          />
                          <ShotTextarea
                            label="Composition"
                            icon={<Layout className="w-3 h-3" />}
                            value={shot.composition}
                            onChange={(value) => updateShot(shot.shot_id, 'composition', value)}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ShotTextarea
                            label="Lighting"
                            icon={<Sun className="w-3 h-3" />}
                            value={shot.ambiance_colour_lighting}
                            onChange={(value) => updateShot(shot.shot_id, 'ambiance_colour_lighting', value)}
                          />
                          <ShotTextarea
                            label="Audio"
                            icon={<Music className="w-3 h-3" />}
                            value={shot.audio}
                            onChange={(value) => updateShot(shot.shot_id, 'audio', value)}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5] mt-2">
                           <div className="flex gap-4">
                              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(shot.contains_brand)}
                                  onChange={(e) => updateShot(shot.shot_id, 'contains_brand', e.target.checked)}
                                  className="rounded border-gray-300 text-black focus:ring-black"
                                />
                                Brand
                              </label>
                              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(shot.contains_product)}
                                  onChange={(e) => updateShot(shot.shot_id, 'contains_product', e.target.checked)}
                                  className="rounded border-gray-300 text-black focus:ring-black"
                                />
                                Product
                              </label>
                           </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ShotInputProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}

function ShotInput({ label, icon, value, onChange, placeholder, type = 'text' }: ShotInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-all"
      />
    </div>
  );
}

interface ShotTextareaProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}

function ShotTextarea({ label, icon, value, onChange }: ShotTextareaProps) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#666666]">
        {icon}
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-all min-h-[80px] resize-y"
      />
    </div>
  );
}
