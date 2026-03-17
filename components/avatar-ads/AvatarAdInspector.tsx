'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, Loader2,
  Image as ImageIcon, Film, Coins, MessageSquare, RefreshCw, CheckCircle
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { countDialogueWords } from '@/lib/avatar-ads-dialogue';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';

// Define the shape of the structured video prompt
export interface StructuredVideoPrompt {
  dialog?: string;
  [key: string]: unknown;
}

// Define the shape of the project data for the inspector
interface InspectorProject {
  id: string;
  generated_image_url?: string;
  generated_video_urls?: string[];
  merged_video_url?: string;
  image_prompt?: string;
  generated_prompts?: {
    scenes: Array<{ prompt: StructuredVideoPrompt }>;
    language?: string;
  };
  credits_cost?: number;
  status: string;
  current_step: string;
}

type MentionOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

interface AvatarAdInspectorProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onConfirmGeneration: (projectId: string, updatedPrompts: any) => Promise<void>;
  onRefetchProjectStatus?: (projectId: string) => void; // ✅ Optional - no longer needed with Realtime
  onRegenerateImage: (projectId: string, imagePrompt: string) => Promise<void>;
  characterMentions?: MentionOption[];
  productMentions?: MentionOption[];
}

const normalizeScenePromptForEditor = (prompt: StructuredVideoPrompt | undefined | null): StructuredVideoPrompt => {
  const dialog = typeof prompt?.dialog === 'string'
    ? prompt.dialog
    : typeof prompt?.dialogue === 'string'
      ? String(prompt.dialogue)
      : typeof prompt?.video_prompt === 'string'
        ? String(prompt.video_prompt).replace('dialogue, the character in the video says: ', '').trim()
        : '';

  return { dialog };
};

const buildDialogueOnlyPrompts = (
  generatedPrompts: InspectorProject['generated_prompts'],
  imagePrompt: string,
  editedScenes: StructuredVideoPrompt[]
) => ({
  ...generatedPrompts,
  image_prompt: imagePrompt,
  scenes: generatedPrompts?.scenes.map((scene, index) => ({
    ...scene,
    prompt: normalizeScenePromptForEditor(editedScenes[index] || scene.prompt)
  })) || []
});

export const AvatarAdInspector: React.FC<AvatarAdInspectorProps> = ({
  projectId,
  open,
  onClose,
  onConfirmGeneration,
  onRegenerateImage,
  characterMentions = [],
  productMentions = [],
}) => {
  const supabase = useSupabaseBrowserClient();
  const { showSuccess, showError } = useToast();
  const [project, setProject] = useState<InspectorProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [editedImagePrompt, setEditedImagePrompt] = useState<string>('');
  const [editedScenes, setEditedScenes] = useState<StructuredVideoPrompt[]>([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isInitialized = useRef(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousProjectIdRef = useRef<string | null>(null);
  
  const scenes = project?.generated_prompts?.scenes ?? [];
  const totalScenes = scenes.length;
  const activeScenePrompt = editedScenes[activeSceneIndex] || scenes[activeSceneIndex]?.prompt || null;
  const previewVideoUrl =
    project?.merged_video_url ||
    (Array.isArray(project?.generated_video_urls) ? project?.generated_video_urls[0] : undefined) ||
    undefined;

  const fetchProjectDetails = useCallback(async ({ isInitialLoad = false }: { isInitialLoad?: boolean } = {}) => {
    if (!projectId) return;
    try {
      const maxRetries = isInitialLoad ? 6 : 3;
      const timeoutMs = isInitialLoad ? 45000 : 20000;
      const response = await fetchWithRetry(
        `/api/avatar-ads/${projectId}/status`,
        { cache: 'no-store' },
        maxRetries,
        timeoutMs
      );
      
      if (response.status === 404 || response.status === 401) {
        console.warn(`Poll failed with status ${response.status}`);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch project details');
      }
      const data = await response.json();
      if (data.project) {
        setProject(data.project);

        // Show spinner for both initial generation and regeneration
        const shouldShowImageSpinner =
          data.project.current_step === 'regenerating_image' ||
          (data.project.status === 'generating_image' && !data.project.generated_image_url);
        setIsRegeneratingImage(shouldShowImageSpinner);
      } else {
        console.warn('Project data missing in response, or response was empty.');
        showError('Project details not found in response.');
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      setProject(prev => {
        if (!prev) {
           showError(error instanceof Error ? error.message : 'Failed to load project details.');
           onClose();
        } else {
           console.warn('Background poll failed:', error);
        }
        return prev;
      });
    }
  }, [projectId, onClose, showError]);

  useEffect(() => {
    if (!open || !projectId) return;

    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`avatar-ads-inspector:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'avatar_ads_projects',
          filter: `id=eq.${projectId}`,
        },
        (payload) => {
          const updatedProject = payload.new as InspectorProject;
          setProject(prev => ({
            ...updatedProject,
            // Preserve generated_prompts if not included in Realtime update
            generated_prompts: updatedProject.generated_prompts ?? prev?.generated_prompts
          }));

          // Show spinner for both initial generation and regeneration
          const shouldShowImageSpinner =
            updatedProject.current_step === 'regenerating_image' ||
            (updatedProject.status === 'generating_image' && !updatedProject.generated_image_url);
          setIsRegeneratingImage(shouldShowImageSpinner);
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [open, projectId, supabase]);

  useEffect(() => {
    const isProjectSwitch = previousProjectIdRef.current !== projectId;

    if (project && (!isInitialized.current || isProjectSwitch)) {
      if (project.image_prompt) {
        setEditedImagePrompt(project.image_prompt);
      }
      if (project.generated_prompts?.scenes?.length) {
        setEditedScenes(project.generated_prompts.scenes.map(scene => normalizeScenePromptForEditor(scene.prompt)));
      } else {
        setEditedScenes([]);
      }
      setActiveSceneIndex(0);
      isInitialized.current = true;
      previousProjectIdRef.current = projectId;
    }
  }, [project, projectId]);

  useEffect(() => {
    if (!totalScenes) {
      setActiveSceneIndex(0);
      return;
    }
    setActiveSceneIndex((prev) => Math.min(prev, totalScenes - 1));
  }, [totalScenes]);

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchProjectDetails({ isInitialLoad: true });
      setLoading(false);
    };

    if (open) {
      setLoading(true);
      isInitialized.current = false;
      loadInitialData();
    } else {
      setProject(null);
      setEditedImagePrompt('');
      setEditedScenes([]);
      setActiveSceneIndex(0);
      setIsRegeneratingImage(false);
      isInitialized.current = false;
      setFocusedField(null);
    }
  }, [open, fetchProjectDetails]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const handleFieldChange = useCallback((field: keyof StructuredVideoPrompt, value: string) => {
    setEditedScenes(prev => {
      const next = [...prev];
      const fallback = normalizeScenePromptForEditor(project?.generated_prompts?.scenes?.[activeSceneIndex]?.prompt);
      const current = next[activeSceneIndex] ?? fallback;
      next[activeSceneIndex] = {
        ...current,
        [field]: value,
      };
      return next;
    });
  }, [activeSceneIndex, project]);

  const handleImagePromptChange = useCallback((value: string) => {
    setEditedImagePrompt(value);
  }, []);

  const handleRegenerateImageClick = async () => {
    if (!project || !editedImagePrompt) return;
    setIsRegeneratingImage(true);
    try {
      await onRegenerateImage(projectId, editedImagePrompt);
      showSuccess('Image regeneration requested!');
    } catch (error) {
      console.error('Error regenerating image:', error);
      showError(error instanceof Error ? error.message : 'Failed to regenerate image.');
      setIsRegeneratingImage(false);
    }
  };

  // Auto-save logic
  const savePrompts = useCallback(async () => {
    if (!project || !projectId) return;

    setAutoSaveStatus('saving');
    try {
      const updatedGeneratedPrompts = {
        ...buildDialogueOnlyPrompts(project.generated_prompts, editedImagePrompt, editedScenes)
      };

      const response = await fetch(`/api/avatar-ads/${projectId}/update-prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedPrompts: updatedGeneratedPrompts })
      });

      if (!response.ok) {
        throw new Error('Failed to save prompts');
      }

      setAutoSaveStatus('saved');

      // Clear "saved" status after 2 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      setAutoSaveStatus('error');
      showError('Failed to save changes. Please check your connection.');

      // Clear error status after 3 seconds
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
    }
  }, [project, projectId, editedImagePrompt, editedScenes, showError]);

  // Debounced auto-save when prompts change
  useEffect(() => {
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Skip auto-save if not initialized or project not loaded
    if (!project || !isInitialized.current) {
      return;
    }

    // Check if there are actual changes
    const imagePromptChanged = editedImagePrompt !== (project.image_prompt || '');
    const scenesChanged = editedScenes.some((editedScene, index) => {
      const originalScene = normalizeScenePromptForEditor(project.generated_prompts?.scenes?.[index]?.prompt);
      return JSON.stringify(normalizeScenePromptForEditor(editedScene)) !== JSON.stringify(originalScene);
    });

    if (!imagePromptChanged && !scenesChanged) {
      return;
    }

    // Debounce: Save after 1.5 seconds of inactivity
    autoSaveTimeoutRef.current = setTimeout(() => {
      savePrompts();
    }, 1500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [editedImagePrompt, editedScenes, project, savePrompts]);

  const handleConfirm = async () => {
    if (!project) return;

    setSubmitting(true);
    try {
      const updatedGeneratedPrompts = {
        ...buildDialogueOnlyPrompts(project.generated_prompts, editedImagePrompt, editedScenes)
      };

      await onConfirmGeneration(projectId, updatedGeneratedPrompts);
    } catch (error) {
      console.error('Error confirming generation:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="avatar-ads-editor relative z-50">
          {/* Backdrop */}
          <motion.div
            className="avatar-ads-editor-backdrop fixed inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Panel */}
          <div className="fixed inset-0 overflow-hidden flex items-center justify-center p-4 sm:p-6">
            <motion.div
              className="avatar-ads-editor-panel w-full max-w-[1680px] h-[90vh] bg-white shadow-2xl rounded-xl flex flex-col overflow-hidden border border-gray-200"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="avatar-ads-editor-header px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-4">
                  <h3 className="avatar-ads-editor-title text-lg font-semibold text-gray-900 flex items-center gap-2">
                    Review & Edit Ad
                    <p className="avatar-ads-editor-subtitle text-xs font-normal text-gray-500 ml-2">Please check image, adjust photos, and confirm video elements before generating.</p>
                  </h3>
                  {/* Auto-save status indicator */}
                  {autoSaveStatus !== 'idle' && (
                    <div className="avatar-ads-editor-status flex items-center gap-1.5">
                      {autoSaveStatus === 'saving' && (
                        <>
                          <Loader2 className="avatar-ads-editor-status-icon w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span className="avatar-ads-editor-status-text text-xs text-blue-600 font-medium">Saving...</span>
                        </>
                      )}
                      {autoSaveStatus === 'saved' && (
                        <>
                          <CheckCircle className="avatar-ads-editor-status-icon w-3.5 h-3.5 text-green-600" />
                          <span className="avatar-ads-editor-status-text text-xs text-green-600 font-medium">Saved</span>
                        </>
                      )}
                      {autoSaveStatus === 'error' && (
                        <span className="avatar-ads-editor-status-text text-xs text-red-600 font-medium">Save failed</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="avatar-ads-editor-close text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content - Split View */}
              <div className="flex-1 flex overflow-hidden">
                {loading ? (
                  <div className="avatar-ads-editor-loading w-full flex flex-col items-center justify-center text-gray-500 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-black" />
                    <p className="text-sm font-medium">Loading project details...</p>
                  </div>
                ) : !project ? (
                  <div className="avatar-ads-editor-error w-full flex flex-col items-center justify-center text-red-500">
                    <p>Failed to load project details.</p>
                  </div>
                ) : (
                  <>
                    {/* LEFT: Image Preview (Fixed / Minimal Scroll) */}
                    <div className="avatar-ads-editor-preview w-[820px] shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
                      <div className="p-6 h-full min-h-0 flex flex-col">
                        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                          <div className="flex min-h-0 flex-col gap-3">
                            <div className="avatar-ads-editor-section-title flex items-center gap-2 text-sm font-medium text-gray-900">
                              <Film className="w-4 h-4" />
                              Video Preview
                            </div>
                            <div className="avatar-ads-editor-media relative w-full flex-1 min-h-0 bg-black rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                              {previewVideoUrl ? (
                                <video
                                  src={previewVideoUrl}
                                  className="h-full w-full object-contain"
                                  controls
                                  playsInline
                                  muted
                                  loop
                                  preload="metadata"
                                  poster={project.generated_image_url}
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                                  Video not ready yet
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex min-h-0 flex-col gap-3">
                            <div className="avatar-ads-editor-section-title flex items-center gap-2 text-sm font-medium text-gray-900">
                              <ImageIcon className="w-4 h-4" />
                              First Frame
                            </div>
                            <div className="avatar-ads-editor-media relative w-full flex-1 min-h-0 bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                              {project.generated_image_url ? (
                                <Image
                                  src={project.generated_image_url}
                                  alt="Generated Cover"
                                  fill
                                  className="object-contain"
                                />
                              ) : (
                                !isRegeneratingImage && (
                                  <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                                    No image
                                  </div>
                                )
                              )}
                              {isRegeneratingImage && (
                                <div className="avatar-ads-editor-media-overlay absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm text-gray-900 p-4 z-10">
                                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                  <p className="text-xs font-medium">Regenerating...</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Editors (Scrollable) */}
                    <div className="avatar-ads-editor-form flex-1 overflow-y-auto bg-white custom-scrollbar">
                      <div className="max-w-3xl mx-auto p-6 space-y-8">

                        {/* Image Prompt Edit Section */}
                        <div className="avatar-ads-editor-card space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <div className="avatar-ads-editor-section-title flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <ImageIcon className="w-4 h-4" />
                                Image Prompt
                              </div>
                              <p className="avatar-ads-editor-helper text-[11px] text-gray-500 pl-6">
                                Adjust prompt to match expectations.
                              </p>
                            </div>
                          </div>
                          <PromptMentionTextarea
                            value={editedImagePrompt}
                            onChange={handleImagePromptChange}
                            rows={3}
                            resizable="vertical"
                            characterMentions={characterMentions}
                            productMentions={productMentions}
                            className={`avatar-ads-editor-textarea text-sm p-3 transition-all duration-200 ${
                              focusedField === 'image_prompt' ? 'min-h-32 bg-gray-50' : 'min-h-[88px] bg-white'
                            }`}
                            preventHorizontalScroll
                            placeholder="Describe the character and setting..."
                          />
                        </div>

                        <hr className="avatar-ads-editor-divider border-gray-100" />

                        {/* Video Scenes Section */}
                        <div className="avatar-ads-editor-card space-y-4">
                           <div className="flex items-start justify-between mb-1">
                             <div className="space-y-0.5">
                               <div className="avatar-ads-editor-section-title flex items-center gap-2 text-sm font-semibold text-gray-900">
                                 <Film className="w-4 h-4" />
                                 Scene Dialogue
                               </div>
                               <p className="avatar-ads-editor-helper text-[11px] text-gray-500 pl-6">
                                 Edit what the character says in each segment.
                               </p>
                             </div>
                           </div>

                           {/* Scene Tabs */}
                           {totalScenes > 0 && (
                             <div className="avatar-ads-editor-tabs flex flex-wrap gap-1 border-b border-gray-100 pb-1">
                               {scenes.map((_, index) => (
                                 <button
                                   key={`scene-tab-${index}`}
                                   onClick={() => setActiveSceneIndex(index)}
                                   className={`avatar-ads-editor-tab px-4 py-2 text-sm font-medium transition-colors relative ${
                                     activeSceneIndex === index
                                       ? 'text-black'
                                       : 'text-gray-500 hover:text-gray-800'
                                   }`}
                                 >
                                   Scene {index + 1}
                                   {activeSceneIndex === index && (
                                     <motion.div
                                       layoutId="activeTab"
                                       className="avatar-ads-editor-tab-indicator absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                                     />
                                   )}
                                 </button>
                               ))}
                             </div>
                           )}

                           {/* Scene Fields */}
                           <div className="pt-2 space-y-4">
                             {totalScenes === 0 ? (
                             <p className="avatar-ads-editor-helper text-sm text-gray-400 italic">No scenes to edit.</p>
                           ) : (
                             <div className="grid grid-cols-1 gap-4">
                               {(() => {
                                 const field = 'dialog' as const;
                                 const isFocused = focusedField === field;
                                 const fieldValue = activeScenePrompt?.dialog || '';
                                 const dialogueWordCount = countDialogueWords(fieldValue);
                                 const dialogueWarning = dialogueWordCount > 0 && dialogueWordCount < 17
                                   ? `Only ${dialogueWordCount} words. Recommended: 17-20 words per 8-second segment to avoid pauses.`
                                   : null;

                                 return (
                                   <div key={field} className="avatar-ads-editor-field group space-y-1.5">
                                     <label
                                       htmlFor={`field_${field}`}
                                       className="avatar-ads-editor-label flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider group-focus-within:text-black transition-colors"
                                     >
                                       <MessageSquare className="w-3.5 h-3.5" />
                                       Dialogue
                                     </label>
                                     <textarea
                                       id={`field_${field}`}
                                       className={`avatar-ads-editor-textarea block w-full rounded-md border-gray-200 shadow-sm focus:border-black focus:ring-black text-sm resize-y p-3 transition-all duration-200 ${
                                         isFocused ? 'min-h-32 bg-gray-50' : 'min-h-[96px] bg-white'
                                       }`}
                                       value={fieldValue}
                                       onChange={(e) => handleFieldChange(field, e.target.value)}
                                       onFocus={() => setFocusedField(field)}
                                       onBlur={() => setFocusedField(null)}
                                     />
                                     {dialogueWarning && (
                                       <p className="avatar-ads-editor-warning text-[11px] text-amber-600 mt-1">
                                         {dialogueWarning}
                                       </p>
                                     )}
                                   </div>
                                 );
                               })()}
                              </div>
                            )}
                           </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="avatar-ads-editor-footer px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3 shrink-0">
                {/* Regenerate Image Button - Moved Here */}
                <button
                   onClick={handleRegenerateImageClick}
                   disabled={submitting || isRegeneratingImage}
                   className="avatar-ads-editor-secondary h-12 px-5 rounded-lg border border-gray-300 text-base font-semibold text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                   <RefreshCw className={`w-4 h-4 ${isRegeneratingImage ? 'animate-spin' : ''}`} />
                   Regenerate Image
                   <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                     FREE
                   </span>
                </button>

                <button
                  onClick={handleConfirm}
                  disabled={submitting || loading || !project}
                  className="avatar-ads-editor-primary h-12 px-6 rounded-lg bg-black text-base font-semibold text-white hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" />
                      Generate Video
                      <span className="ml-1 inline-flex items-center gap-1 rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        <Coins className="h-3 w-3" />
                        {project?.credits_cost ?? 0}
                      </span>
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
