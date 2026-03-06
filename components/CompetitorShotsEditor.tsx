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
  Clock,
  Film,
  Camera,
  MessageSquare
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
  readOnly?: boolean;
  hideHeader?: boolean;
  expandedMaxHeightClass?: string;
}

export default function CompetitorShotsEditor({
  shots,
  onShotsChange,
  title,
  description,
  showSummary = true,
  readOnly = false,
  hideHeader = false,
  expandedMaxHeightClass
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
    if (readOnly) return;
    const nextId = shots.length + 1;
    const nextShots = [...shots, createEmptyShot(nextId)];
    onShotsChange(nextShots);
    setExpandedShots(prev => new Set([...prev, nextId]));
  };

  const handleRemoveShot = (shotId: number) => {
    if (readOnly) return;
    const nextShots = reindexShots(shots.filter(shot => shot.shot_id !== shotId));
    onShotsChange(nextShots);
    setExpandedShots(prev => {
      const next = new Set(prev);
      next.delete(shotId);
      return next;
    });
  };

  const updateShot = <K extends keyof CompetitorShotForm>(shotId: number, key: K, value: CompetitorShotForm[K]) => {
    if (readOnly) return;
    const nextShots = shots.map(shot => (shot.shot_id === shotId ? { ...shot, [key]: value } : shot));
    onShotsChange(nextShots);
  };

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      {!hideHeader && (
        <div className="flex items-end justify-between border-b border-[#E5E5E5] pb-4">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-black tracking-tight flex items-center gap-2">
              {title || "Shot List"}
              {showSummary && (
                <span className="inline-flex items-center rounded-full bg-[#F7F7F7] border border-[#E5E5E5] px-2.5 py-0.5 text-xs font-medium text-[#666666]">
                  {shots.length} shots • {totalDuration}s total
                </span>
              )}
            </h3>
            {description && <p className="text-sm text-[#666666]">{description}</p>}
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddShot}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E5E5] rounded-lg text-sm font-medium text-black hover:bg-[#F7F7F7] transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Shot
            </button>
          )}
        </div>
      )}

      {shots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-[#FAFAFA] p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#F0F0F0] flex items-center justify-center mb-4 text-[#666666]">
            <Film className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-black mb-1">No shots available</h4>
          <p className="text-sm text-[#666666] max-w-xs mx-auto">
            {readOnly ? 'Run analysis to generate structured shots for this video.' : 'Start building your video by adding shots to the storyboard.'}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={handleAddShot}
              className="inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/90 transition-colors shadow-lg shadow-black/10 mt-6"
            >
              <Plus className="w-4 h-4" />
              Add First Shot
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {shots.map((shot, index) => {
            const isExpanded = expandedShots.has(shot.shot_id);
            return (
              <div 
                key={shot.shot_id} 
                className={cn(
                  "group rounded-xl border bg-white transition-all duration-200 overflow-hidden",
                  isExpanded 
                    ? "border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/5" 
                    : "border-[#E5E5E5] hover:border-gray-300 hover:shadow-sm"
                )}
              >
                {/* Card Header / Summary */}
                <div
                  onClick={() => toggleShot(shot.shot_id)}
                  className="flex w-full items-center justify-between px-5 py-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-colors",
                      isExpanded ? "bg-black text-white" : "bg-[#F7F7F7] text-black group-hover:bg-[#EAEAEA]"
                    )}>
                      {index + 1}
                    </div>
                    
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="text-sm font-semibold text-black flex items-center gap-2">
                        Shot {index + 1}
                        {shot.subject && <span className="text-xs font-normal text-[#666666]">• {shot.subject.substring(0, 30)}{shot.subject.length > 30 ? '...' : ''}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#666666] font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {shot.start_time || '00:00'} - {shot.end_time || '00:00'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{shot.duration_seconds}s</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveShot(shot.shot_id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete shot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className={cn(
                      "p-1 rounded-md transition-transform duration-200",
                      isExpanded ? "bg-gray-100 rotate-180" : "bg-transparent"
                    )}>
                      <ChevronDown className="w-4 h-4 text-[#666666]" />
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      <div className={cn(
                        "border-t border-[#E5E5E5] bg-[#FAFAFA]/50 p-5 space-y-6",
                        expandedMaxHeightClass
                      )}>
                        
                        {/* Section: Timing */}
                        <div className="space-y-3">
                          <SectionHeader icon={<Clock className="w-3.5 h-3.5" />} title="Timing" />
                          <div className="grid grid-cols-3 gap-4">
                            <ShotInput
                              label="Start Time"
                              value={shot.start_time}
                              onChange={(value) => updateShot(shot.shot_id, 'start_time', value)}
                              placeholder="00:00"
                              mono
                              readOnly={readOnly}
                            />
                            <ShotInput
                              label="End Time"
                              value={shot.end_time}
                              onChange={(value) => updateShot(shot.shot_id, 'end_time', value)}
                              placeholder="00:08"
                              mono
                              readOnly={readOnly}
                            />
                            <ShotInput
                              label="Duration (s)"
                              type="number"
                              value={String(shot.duration_seconds)}
                              onChange={(value) => updateShot(shot.shot_id, 'duration_seconds', Number(value))}
                              mono
                              readOnly={readOnly}
                            />
                          </div>
                        </div>

                        {/* Section: Visual Content */}
                        <div className="space-y-3">
                          <SectionHeader icon={<Eye className="w-3.5 h-3.5" />} title="Visual Content" />
                          <ShotTextarea
                            label="Visual Description (Prompts)"
                            value={shot.first_frame_description}
                            onChange={(value) => updateShot(shot.shot_id, 'first_frame_description', value)}
                            placeholder="Describe what happens in this shot in detail..."
                            minHeight="min-h-[100px]"
                            readOnly={readOnly}
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ShotTextarea
                              label="Subject"
                              value={shot.subject}
                              onChange={(value) => updateShot(shot.shot_id, 'subject', value)}
                              placeholder="e.g. A woman in a red dress"
                              readOnly={readOnly}
                            />
                            <ShotTextarea
                              label="Environment"
                              value={shot.context_environment}
                              onChange={(value) => updateShot(shot.shot_id, 'context_environment', value)}
                              placeholder="e.g. Sunny park, afternoon"
                              readOnly={readOnly}
                            />
                          </div>
                        </div>

                        {/* Section: Style & Camera */}
                        <div className="space-y-3">
                          <SectionHeader icon={<Camera className="w-3.5 h-3.5" />} title="Cinematography" />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ShotTextarea
                              label="Camera Motion"
                              value={shot.camera_motion_positioning}
                              onChange={(value) => updateShot(shot.shot_id, 'camera_motion_positioning', value)}
                              placeholder="e.g. Slow pan right, close up"
                              readOnly={readOnly}
                            />
                            <ShotTextarea
                              label="Composition"
                              value={shot.composition}
                              onChange={(value) => updateShot(shot.shot_id, 'composition', value)}
                              placeholder="e.g. Rule of thirds, center framed"
                              readOnly={readOnly}
                            />
                            <ShotTextarea
                              label="Lighting"
                              value={shot.ambiance_colour_lighting}
                              onChange={(value) => updateShot(shot.shot_id, 'ambiance_colour_lighting', value)}
                              placeholder="e.g. Soft natural lighting, warm tones"
                              readOnly={readOnly}
                            />
                            <ShotTextarea
                              label="Art Style"
                              value={shot.style}
                              onChange={(value) => updateShot(shot.shot_id, 'style', value)}
                              placeholder="e.g. Cinematic, photorealistic, film grain"
                              readOnly={readOnly}
                            />
                          </div>
                        </div>

                        {/* Section: Audio */}
                        <div className="space-y-3">
                          <SectionHeader icon={<Music className="w-3.5 h-3.5" />} title="Audio & Action" />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ShotTextarea
                              label="Action"
                              value={shot.action}
                              onChange={(value) => updateShot(shot.shot_id, 'action', value)}
                              placeholder="Describe the movement..."
                              readOnly={readOnly}
                            />
                            <ShotTextarea
                              label="Audio Summary"
                              value={shot.audio_summary}
                              onChange={(value) => updateShot(shot.shot_id, 'audio_summary', value)}
                              placeholder="Music bed, sound effects, or ambient audio"
                              readOnly={readOnly}
                            />
                            <ShotTextarea
                              label="Dialogue"
                              value={shot.dialogue}
                              onChange={(value) => updateShot(shot.shot_id, 'dialogue', value)}
                              placeholder="Literal spoken line from this shot"
                              readOnly={readOnly}
                            />
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

// Sub-components

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[#666666] mb-1">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
    </div>
  );
}

interface ShotInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  mono?: boolean;
  readOnly?: boolean;
}

function ShotInput({ label, value, onChange, placeholder, type = 'text', mono, readOnly }: ShotInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-[#666666]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
        className={cn(
          "w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black placeholder:text-gray-300",
          readOnly ? "bg-gray-50 text-gray-600" : "bg-white",
          readOnly ? "focus:outline-none focus:ring-0" : "focus:border-black focus:outline-none focus:ring-1 focus:ring-black",
          "transition-all disabled:cursor-not-allowed",
          mono && "font-mono"
        )}
      />
    </div>
  );
}

interface ShotTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
}

function ShotTextarea({ label, value, onChange, placeholder, minHeight = "min-h-[80px]", readOnly }: ShotTextareaProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-[#666666]">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        className={cn(
          "w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black placeholder:text-gray-300 resize-y",
          readOnly ? "bg-gray-50 text-gray-600" : "bg-white",
          readOnly ? "focus:outline-none focus:ring-0" : "focus:border-black focus:outline-none focus:ring-1 focus:ring-black",
          "transition-all disabled:cursor-not-allowed",
          minHeight
        )}
      />
    </div>
  );
}
