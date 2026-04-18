'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2,
  Image as ImageIcon, Film, Coins, MessageSquare, RefreshCw, CheckCircle, PencilLine, ArrowRight
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import { buildMentionToken, MENTION_TOKEN_REGEX } from '@/lib/prompt-mention-tokens';

// Define the shape of the structured video prompt
export interface StructuredVideoPrompt {
  dialog?: string | Record<string, string>;
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
  onRegenerateVideo: (projectId: string, updatedPrompts: any) => Promise<void>;
  characterMentions?: MentionOption[];
  productMentions?: MentionOption[];
}

const normalizeScenePromptForEditor = (prompt: StructuredVideoPrompt | undefined | null): StructuredVideoPrompt => {
  const dialog = typeof prompt?.dialog === 'string'
    ? prompt.dialog
    : prompt?.dialog && typeof prompt.dialog === 'object' && !Array.isArray(prompt.dialog)
      ? Object.entries(prompt.dialog)
        .sort(([timeA], [timeB]) => {
          const startA = Number((timeA.match(/^(\d+)/) || [])[1] || 0);
          const startB = Number((timeB.match(/^(\d+)/) || [])[1] || 0);
          return startA - startB;
        })
        .map(([, value]) => String(value).trim())
        .filter(Boolean)
        .join('\n')
      : typeof prompt?.dialogue === 'string'
      ? String(prompt.dialogue)
      : typeof prompt?.video_prompt === 'string'
        ? String(prompt.video_prompt).replace('dialogue, the character in the video says: ', '').trim()
        : '';

  return {
    ...(prompt || {}),
    dialog,
  };
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
    prompt: {
      ...(scene.prompt || {}),
      ...normalizeScenePromptForEditor(editedScenes[index] || scene.prompt)
    }
  })) || []
});

const buildPromptUpdatePayload = (
  generatedPrompts: InspectorProject['generated_prompts'],
  imagePrompt: string,
  editedScenes: StructuredVideoPrompt[]
) => {
  const updatedPrompts = buildDialogueOnlyPrompts(generatedPrompts, imagePrompt, editedScenes);
  return {
    updatedPrompts,
    imagePrompt,
  };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenizePromptMentions = (
  value: string,
  characterMentions: MentionOption[],
  productMentions: MentionOption[]
) => {
  if (!value.trim()) return value;

  MENTION_TOKEN_REGEX.lastIndex = 0;
  if (MENTION_TOKEN_REGEX.test(value)) {
    MENTION_TOKEN_REGEX.lastIndex = 0;
    return value;
  }

  const mentionItems = [
    ...characterMentions.map((item) => ({ ...item, type: 'character' as const })),
    ...productMentions.map((item) => ({ ...item, type: 'product' as const })),
  ]
    .filter((item) => item.label.trim().length > 0)
    .sort((a, b) => b.label.length - a.label.length);

  if (mentionItems.length === 0) {
    return value;
  }

  let nextValue = value;

  for (const item of mentionItems) {
    const token = buildMentionToken({ type: item.type, label: item.label });
    const pattern = new RegExp(`(^|[^A-Za-z0-9_@])(${escapeRegExp(item.label)})(?=$|[^A-Za-z0-9_])`, 'gi');
    nextValue = nextValue.replace(pattern, (match, prefix, label) => `${prefix}${token}`);
  }

  return nextValue;
};

export const AvatarAdInspector: React.FC<AvatarAdInspectorProps> = ({
  projectId,
  open,
  onClose,
  onConfirmGeneration,
  onRegenerateImage,
  onRegenerateVideo,
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
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isInitialized = useRef(false);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousProjectIdRef = useRef<string | null>(null);
  
  const scenes = project?.generated_prompts?.scenes ?? [];
  const totalScenes = scenes.length;
  const previewVideoUrl =
    project?.merged_video_url ||
    (Array.isArray(project?.generated_video_urls) ? project?.generated_video_urls[0] : undefined) ||
    undefined;
  const hasGeneratedImage = Boolean(project?.generated_image_url);
  const hasGeneratedVideos = Boolean(project?.merged_video_url) || Boolean(project?.generated_video_urls?.length);
  const isGeneratingVideo =
    project?.status === 'generating_videos' ||
    project?.current_step === 'generating_videos';
  const canGenerateVideo = Boolean(hasGeneratedImage && !submitting && !loading && project && !isGeneratingVideo);

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
          data.project.current_step === 'generating_image' ||
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
            updatedProject.current_step === 'generating_image' ||
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
        setEditedImagePrompt(tokenizePromptMentions(project.image_prompt, characterMentions, productMentions));
      }
      if (project.generated_prompts?.scenes?.length) {
        setEditedScenes(project.generated_prompts.scenes.map(scene => normalizeScenePromptForEditor(scene.prompt)));
      } else {
        setEditedScenes([]);
      }
      isInitialized.current = true;
      previousProjectIdRef.current = projectId;
    }
  }, [project, projectId, characterMentions, productMentions]);

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
      setIsRegeneratingImage(false);
      isInitialized.current = false;
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

  const handleImagePromptChange = useCallback((value: string) => {
    setEditedImagePrompt(value);
  }, []);

  const combinedDialogue = useMemo(() => {
    return editedScenes.map(s => s.dialog || '').join('\n');
  }, [editedScenes]);

  const handleCombinedDialogueChange = useCallback((value: string) => {
    const parts = value.split(/\n/);
    setEditedScenes(prev =>
      prev.map((scene, index) => ({
        ...scene,
        dialog: parts[index] ?? '',
      }))
    );
  }, []);

  const handleRegenerateImageClick = async () => {
    if (!project || !editedImagePrompt) return;
    setIsRegeneratingImage(true);
    try {
      await onRegenerateImage(projectId, editedImagePrompt);
      // Toast is shown in handleRegenerateImage in AvatarAdsPage
    } catch (error) {
      console.error('Error regenerating image:', error);
      showError(error instanceof Error ? error.message : 'Failed to regenerate image.');
      setIsRegeneratingImage(false);
    }
  };

  const handleRegenerateVideoClick = async () => {
    if (!project || !hasGeneratedImage) return;
    setSubmitting(true);
    try {
      const payload = buildPromptUpdatePayload(project.generated_prompts, editedImagePrompt, editedScenes);
      await onRegenerateVideo(projectId, payload.updatedPrompts);
      // Toast is shown in handleRegenerateVideo in AvatarAdsPage
    } catch (error) {
      console.error('Error regenerating video:', error);
      showError(error instanceof Error ? error.message : 'Failed to regenerate video.');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-save logic
  const savePrompts = useCallback(async () => {
    if (!project || !projectId) return;

    setAutoSaveStatus('saving');
    try {
      const payload = buildPromptUpdatePayload(project.generated_prompts, editedImagePrompt, editedScenes);

      const response = await fetch(`/api/avatar-ads/${projectId}/update-prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save prompts');
      }

      setProject((prev) => (
        prev
          ? {
              ...prev,
              image_prompt: payload.imagePrompt,
              generated_prompts: payload.updatedPrompts,
            }
          : prev
      ));

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
    if (!project || !hasGeneratedImage) return;

    setSubmitting(true);
    try {
      const payload = buildPromptUpdatePayload(project.generated_prompts, editedImagePrompt, editedScenes);

      await onConfirmGeneration(projectId, payload.updatedPrompts);
      // Optimistic update: make generation state visible immediately,
      // then Realtime/status polling will keep it in sync.
      setProject((prev) => (
        prev
          ? {
              ...prev,
              image_prompt: payload.imagePrompt,
              generated_prompts: payload.updatedPrompts,
              status: 'generating_videos',
              current_step: 'generating_videos',
            }
          : prev
      ));
      await fetchProjectDetails();
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
                <div className="flex items-center gap-8">
                  <h3 className="avatar-ads-editor-title text-lg font-semibold text-gray-900 flex items-center gap-2 whitespace-nowrap">
                    <PencilLine className="h-4 w-4" />
                    Edit
                  </h3>
                  <div className="hidden lg:flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-2 max-w-[320px]">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white shrink-0">1</span>
                      <p className="leading-4 font-semibold text-gray-900">Edit image and generate image</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
                    <div className="flex items-center gap-2 max-w-[320px]">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white shrink-0">2</span>
                      <p className="leading-4 font-semibold text-gray-900">Check dialogue and generate video</p>
                    </div>
                  </div>
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
                                isGeneratingVideo ? (
                                  <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-300 text-xs">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Generating video...</span>
                                  </div>
                                ) : (
                                  <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                                    Video not ready yet
                                  </div>
                                )
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
                                  <p className="text-xs font-medium">{hasGeneratedImage ? 'Regenerating...' : 'Generating...'}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Editors (Scrollable) */}
                    <div className="avatar-ads-editor-form flex-1 overflow-hidden bg-white custom-scrollbar">
                      <div className="max-w-3xl mx-auto p-6 h-full flex flex-col gap-6">
                        {/* Image Prompt Edit Section */}
                        <div className="avatar-ads-editor-card flex-[2] min-h-0 flex flex-col gap-3">
                          <div className="flex items-start justify-between shrink-0">
                            <div className="avatar-ads-editor-section-title flex items-center gap-2 text-base font-semibold text-gray-900">
                              <ImageIcon className="w-5 h-5" />
                              Image Prompt
                            </div>
                          </div>
                          <p className="avatar-ads-editor-helper text-sm text-gray-500">
                            Type `@` to insert a character or product reference.
                          </p>
                          <div className="flex-1 min-h-0">
                            <PromptMentionTextarea
                              value={editedImagePrompt}
                              onChange={handleImagePromptChange}
                              rows={3}
                              characterMentions={characterMentions}
                              productMentions={productMentions}
                              className="text-sm p-3 bg-white"
                              preventHorizontalScroll
                              renderHighlightsWhileFocused
                              placeholder="Describe the character and setting..."
                            />
                          </div>
                        </div>

                        {/* Dialogue Section */}
                        <div className="avatar-ads-editor-card flex-[3] min-h-0 flex flex-col gap-3">
                          <div className="flex items-start justify-between shrink-0">
                            <div className="avatar-ads-editor-section-title flex items-center gap-2 text-base font-semibold text-gray-900">
                              <MessageSquare className="w-5 h-5" />
                              Dialogue
                            </div>
                          </div>
                          <div className="flex-1 min-h-0">
                            {totalScenes === 0 ? (
                              <p className="text-sm text-gray-400 italic">No scenes to edit.</p>
                            ) : (
                              <textarea
                                className="block h-full w-full min-h-0 rounded-lg border border-gray-200 bg-white shadow-sm focus:border-black focus:outline-none focus:ring-0 text-sm resize-none p-3 overflow-y-auto transition-colors"
                                value={combinedDialogue}
                                onChange={(e) => handleCombinedDialogueChange(e.target.value)}
                                placeholder="Enter the dialogue for all segments..."
                              />
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
                   className="landing-press-button landing-press-button--secondary landing-press-button--compact text-sm font-semibold"
                >
                   <RefreshCw className={`w-4 h-4 ${isRegeneratingImage ? 'animate-spin' : ''}`} />
                   {hasGeneratedImage ? 'Regenerate Image' : 'Generate Image'}
                   <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2 py-0.5 text-[11px] font-bold text-white">
                     FREE
                   </span>
                </button>

                <button
                  onClick={hasGeneratedVideos ? handleRegenerateVideoClick : handleConfirm}
                  disabled={!canGenerateVideo}
                  className="landing-press-button landing-press-button--compact text-sm font-semibold"
                >
                  {submitting || isGeneratingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" />
                      {hasGeneratedVideos ? 'Regenerate Video' : 'Generate Video'}
                      <span className="ml-1 inline-flex items-center gap-1 rounded-lg border border-emerald-900 bg-emerald-800 px-2 py-0.5 text-[11px] font-bold text-white">
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
