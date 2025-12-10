'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, X, Loader2, 
  Image as ImageIcon, Film, User, MapPin, Zap, Palette, 
  Camera, Layout, Sun, Music, MessageSquare, Mic, RefreshCw, Award
} from 'lucide-react';
import { GiBanana } from 'react-icons/gi';
import { useToast } from '@/contexts/ToastContext';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

// Define the shape of the structured video prompt
export interface StructuredVideoPrompt {
  subject?: string;
  context_environment?: string;
  action?: string;
  style?: string;
  camera_motion_positioning?: string;
  composition?: string;
  ambiance_color_lighting?: string;
  audio?: string;
  dialog?: string;
  voice_type?: string;
}

// Define the shape of the project data for the inspector
interface InspectorProject {
  id: string;
  generated_image_url?: string;
  image_prompt?: string;
  generated_prompts?: {
    scenes: Array<{ prompt: StructuredVideoPrompt }>;
    language?: string;
  };
  status: string;
  current_step: string;
}

interface CharacterAdInspectorProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onConfirmGeneration: (projectId: string, updatedPrompts: any) => Promise<void>;
  onRefetchProjectStatus: (projectId: string) => void;
  onRegenerateImage: (projectId: string, imagePrompt: string) => Promise<void>;
}

const FIELD_ORDER: Array<keyof StructuredVideoPrompt> = [
  'subject',
  'context_environment',
  'action',
  'style',
  'camera_motion_positioning',
  'composition',
  'ambiance_color_lighting',
  'audio',
  'dialog',
  'voice_type'
];

const FIELD_LABELS: Record<keyof StructuredVideoPrompt, string> = {
  subject: 'Subject',
  context_environment: 'Context & Environment',
  action: 'Action',
  style: 'Style',
  camera_motion_positioning: 'Camera Motion',
  composition: 'Composition',
  ambiance_color_lighting: 'Lighting & Ambiance',
  audio: 'Audio',
  dialog: 'Dialogue',
  voice_type: 'Voice Type'
};

const FIELD_ICONS: Record<keyof StructuredVideoPrompt, React.ElementType> = {
  subject: User,
  context_environment: MapPin,
  action: Zap,
  style: Palette,
  camera_motion_positioning: Camera,
  composition: Layout,
  ambiance_color_lighting: Sun,
  audio: Music,
  dialog: MessageSquare,
  voice_type: Mic
};

export const CharacterAdInspector: React.FC<CharacterAdInspectorProps> = ({
  projectId,
  open,
  onClose,
  onConfirmGeneration,
  onRefetchProjectStatus,
  onRegenerateImage,
}) => {
  const { showSuccess, showError } = useToast();
  const [project, setProject] = useState<InspectorProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [editedImagePrompt, setEditedImagePrompt] = useState<string>('');
  const [editedScenes, setEditedScenes] = useState<StructuredVideoPrompt[]>([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isInitialized = useRef(false);
  
  const scenes = project?.generated_prompts?.scenes ?? [];
  const totalScenes = scenes.length;
  const activeScenePrompt = editedScenes[activeSceneIndex] || scenes[activeSceneIndex]?.prompt || null;

  const fetchProjectDetails = useCallback(async ({ isInitialLoad = false }: { isInitialLoad?: boolean } = {}) => {
    if (!projectId) return;
    try {
      const maxRetries = isInitialLoad ? 6 : 3;
      const timeoutMs = isInitialLoad ? 45000 : 20000;
      const response = await fetchWithRetry(
        `/api/character-ads/${projectId}/status`,
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

        const shouldShowImageSpinner =
          data.project.status === 'generating_image' && !data.project.generated_image_url;
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
    if (project && !isInitialized.current) {
      if (project.image_prompt) {
        setEditedImagePrompt(project.image_prompt);
      }
      if (project.generated_prompts?.scenes?.length) {
        setEditedScenes(project.generated_prompts.scenes.map(scene => ({ ...scene.prompt })));
      } else {
        setEditedScenes([]);
      }
      setActiveSceneIndex(0);
      isInitialized.current = true;
    }
  }, [project]);

  useEffect(() => {
    if (!totalScenes) {
      setActiveSceneIndex(0);
      return;
    }
    setActiveSceneIndex((prev) => Math.min(prev, totalScenes - 1));
  }, [totalScenes]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const loadInitialData = async () => {
      await fetchProjectDetails({ isInitialLoad: true });
      setLoading(false);
    };

    if (open) {
      setLoading(true);
      isInitialized.current = false;
      loadInitialData();
      intervalId = setInterval(() => {
        fetchProjectDetails();
      }, 3000);
    } else {
      setProject(null);
      setEditedImagePrompt('');
      setEditedScenes([]);
      setActiveSceneIndex(0);
      setIsRegeneratingImage(false);
      isInitialized.current = false;
      setFocusedField(null);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
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
      const fallback = project?.generated_prompts?.scenes?.[activeSceneIndex]?.prompt ?? {};
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

  const handleConfirm = async () => {
    if (!project) return;

    setSubmitting(true);
    try {
      const updatedGeneratedPrompts = {
        ...project.generated_prompts,
        image_prompt: editedImagePrompt,
        scenes: project.generated_prompts?.scenes.map((scene, index) => {
          const editedPrompt = editedScenes[index];
          return editedPrompt ? { ...scene, prompt: editedPrompt } : scene;
        })
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
        <div className="relative z-50">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Panel */}
          <div className="fixed inset-0 overflow-hidden flex items-center justify-center p-4 sm:p-6">
            <motion.div
              className="w-full max-w-6xl h-[90vh] bg-white shadow-2xl rounded-xl flex flex-col overflow-hidden border border-gray-200"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  Review & Edit Ad
                  <p className="text-xs font-normal text-gray-500 ml-2">Please check image, adjust photos, and confirm video elements before generating.</p>
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content - Split View */}
              <div className="flex-1 flex overflow-hidden">
                {loading ? (
                  <div className="w-full flex flex-col items-center justify-center text-gray-500 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-black" />
                    <p className="text-sm font-medium">Loading project details...</p>
                  </div>
                ) : !project ? (
                  <div className="w-full flex flex-col items-center justify-center text-red-500">
                    <p>Failed to load project details.</p>
                  </div>
                ) : (
                  <>
                    {/* LEFT: Image Preview (Fixed / Minimal Scroll) */}
                    <div className="w-[400px] shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
                      <div className="p-6 space-y-6">
                         {/* Image Container */}
                        <div className="space-y-3">
                           <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                              <ImageIcon className="w-4 h-4" />
                              Video First Frame
                           </div>
                           <div className="relative aspect-[9/16] w-full bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                              {project.generated_image_url ? (
                                <Image
                                  src={project.generated_image_url}
                                  alt="Generated Cover"
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                !isRegeneratingImage && (
                                  <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                                    No image
                                  </div>
                                )
                              )}
                              {isRegeneratingImage && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm text-gray-900 p-4 z-10">
                                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                  <p className="text-xs font-medium">Regenerating...</p>
                                </div>
                              )}
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Editors (Scrollable) */}
                    <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                      <div className="max-w-3xl mx-auto p-6 space-y-8">
                        
                        {/* Image Prompt Edit Section */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <ImageIcon className="w-4 h-4" />
                                Image Prompt
                              </div>
                              <p className="text-[11px] text-gray-500 pl-6">
                                Adjust prompt to match expectations.
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 border border-yellow-100 shadow-sm">
                              <GiBanana className="w-3.5 h-3.5 text-yellow-600" />
                              <span className="text-[10px] font-medium text-yellow-700 tracking-wide">
                                Nano banana Pro: Unlimited Free
                              </span>
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            className={`block w-full rounded-md border-gray-200 shadow-sm focus:border-black focus:ring-black text-sm resize-none p-3 transition-all duration-200 ${
                              focusedField === 'image_prompt' ? 'h-32 bg-gray-50' : 'bg-white'
                            }`}
                            value={editedImagePrompt}
                            onChange={(e) => handleImagePromptChange(e.target.value)}
                            onFocus={() => setFocusedField('image_prompt')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="Describe the character and setting..."
                          />
                        </div>

                        <hr className="border-gray-100" />

                        {/* Video Scenes Section */}
                        <div className="space-y-4">
                           <div className="flex items-start justify-between mb-1">
                             <div className="space-y-0.5">
                               <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                 <Film className="w-4 h-4" />
                                 Video Prompts
                               </div>
                               <p className="text-[11px] text-gray-500 pl-6">
                                 Please check and modify to meet expectations.
                               </p>
                             </div>
                           </div>

                           {/* Scene Tabs */}
                           {totalScenes > 0 && (
                             <div className="flex flex-wrap gap-1 border-b border-gray-100 pb-1">
                               {scenes.map((_, index) => (
                                 <button
                                   key={`scene-tab-${index}`}
                                   onClick={() => setActiveSceneIndex(index)}
                                   className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                                     activeSceneIndex === index
                                       ? 'text-black'
                                       : 'text-gray-500 hover:text-gray-800'
                                   }`}
                                 >
                                   Scene {index + 1}
                                   {activeSceneIndex === index && (
                                     <motion.div
                                       layoutId="activeTab"
                                       className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                                     />
                                   )}
                                 </button>
                               ))}
                             </div>
                           )}

                           {/* Scene Fields */}
                           <div className="pt-2 space-y-4">
                             {totalScenes === 0 ? (
                               <p className="text-sm text-gray-400 italic">No scenes to edit.</p>
                             ) : (
                               <div className="grid grid-cols-1 gap-4">
                                 {FIELD_ORDER.map((field) => {
                                    const Icon = FIELD_ICONS[field];
                                    const isFocused = focusedField === field;
                                    return (
                                      <div key={field} className="group space-y-1.5">
                                        <label 
                                          htmlFor={`field_${field}`} 
                                          className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider group-focus-within:text-black transition-colors"
                                        >
                                          <Icon className="w-3.5 h-3.5" />
                                          {FIELD_LABELS[field]}
                                        </label>
                                        <textarea
                                          id={`field_${field}`}
                                          className={`block w-full rounded-md border-gray-200 shadow-sm focus:border-black focus:ring-black text-sm resize-none p-3 transition-all duration-200 ${
                                            isFocused ? 'h-32 bg-gray-50' : 'h-10 bg-white overflow-hidden'
                                          }`}
                                          value={activeScenePrompt?.[field] || ''}
                                          onChange={(e) => handleFieldChange(field, e.target.value)}
                                          onFocus={() => setFocusedField(field)}
                                          onBlur={() => setFocusedField(null)}
                                        />
                                      </div>
                                    );
                                 })}
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
              <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>

                {/* Regenerate Image Button - Moved Here */}
                <button
                   onClick={handleRegenerateImageClick}
                   disabled={submitting || isRegeneratingImage}
                   className="px-4 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                   <RefreshCw className={`w-4 h-4 ${isRegeneratingImage ? 'animate-spin' : ''}`} />
                   Regenerate Image
                </button>

                <button
                  onClick={handleConfirm}
                  disabled={submitting || loading || !project}
                  className="px-6 py-2 rounded-md bg-black text-sm font-medium text-white hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Video...
                    </>
                  ) : (
                    <>
                      Generate Video
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