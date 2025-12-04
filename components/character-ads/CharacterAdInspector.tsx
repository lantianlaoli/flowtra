'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, ChevronDown } from 'lucide-react';
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
  camera_motion_positioning: 'Camera Motion & Positioning',
  composition: 'Composition',
  ambiance_color_lighting: 'Ambiance, Color & Lighting',
  audio: 'Audio',
  dialog: 'Dialogue',
  voice_type: 'Voice Type'
};

export const CharacterAdInspector: React.FC<CharacterAdInspectorProps> = ({
  projectId,
  open,
  onClose,
  onConfirmGeneration,
  onRefetchProjectStatus,
  onRegenerateImage, // Added new prop
}) => {
  const { showSuccess, showError } = useToast();
  const [project, setProject] = useState<InspectorProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false); // New state for image loading
  const [editedImagePrompt, setEditedImagePrompt] = useState<string>(''); // New state for image prompt
  const [editedVideoPrompt, setEditedVideoPrompt] = useState<StructuredVideoPrompt | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0); // New state for active scene
  const [isSceneExpanded, setIsSceneExpanded] = useState(true); // State for collapsible scene card
  const isInitialized = useRef(false); // Track if we've populated the edit buffers

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
      
      // Handle 404 or 401 silently during polling (might be transient)
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
        // Don't close immediately, let poll retry or rely on user closing
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
      // Only show error if we don't have project data yet (initial load)
      // or if it's a persistent critical error.
      // For transient polling errors, just warn.
      setProject(prev => {
        if (!prev) { // If it's the very first fetch for an uninitialized project
           showError(error instanceof Error ? error.message : 'Failed to load project details.');
           onClose(); // Close the inspector only on initial critical error
        } else {
           // For background polls, just log error, don't show toast or close modal
           console.warn('Background poll failed:', error);
        }
        return prev;
      });
    }
  }, [projectId, onClose, showError, submitting]);

  // Initialize edit buffers when project data is first loaded
  useEffect(() => {
    if (project && !isInitialized.current) {
      if (project.image_prompt) {
        setEditedImagePrompt(project.image_prompt);
      }
      if (project.generated_prompts?.scenes?.[0]?.prompt) {
        setEditedVideoPrompt(project.generated_prompts.scenes[0].prompt);
      }
      isInitialized.current = true;
    }
  }, [project]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const loadInitialData = async () => {
      console.log('loadInitialData: fetching details...');
      await fetchProjectDetails({ isInitialLoad: true });
      console.log('loadInitialData: fetch complete, setLoading(false)');
      setLoading(false); // Only set loading to false after the initial fetch
    };

    if (open) {
      console.log('Inspector opened: setLoading(true)');
      setLoading(true); // Initial loading state
      isInitialized.current = false; // Reset initialization flag
      loadInitialData(); // Call the initial load function
      // Poll for updates while open
      intervalId = setInterval(() => {
        console.log('Polling fetchProjectDetails...');
        fetchProjectDetails();
      }, 3000);
    } else {
      console.log('Inspector closed: cleaning up.');
      setProject(null);
      setEditedImagePrompt(''); // Reset on close
      setEditedVideoPrompt(null);
      setActiveSceneIndex(0);
      setIsRegeneratingImage(false); // Reset on close
      isInitialized.current = false;
    }
    return () => {
      if (intervalId) {
        console.log('Clearing polling interval.');
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Handle ESC key
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
    setEditedVideoPrompt(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleImagePromptChange = useCallback((value: string) => {
    setEditedImagePrompt(value);
  }, []);

  const handleRegenerateImageClick = async () => {
    if (!project || !editedImagePrompt) return;
    setIsRegeneratingImage(true); // Set image loading state
    // setSubmitting(true); // NO, only for video generation
    try {
      await onRegenerateImage(projectId, editedImagePrompt);
      showSuccess('Image regeneration requested!');
      // isRegeneratingImage will be set to false by fetchProjectDetails when new image URL arrives
    } catch (error) {
      console.error('Error regenerating image:', error);
      showError(error instanceof Error ? error.message : 'Failed to regenerate image.');
      setIsRegeneratingImage(false); // Reset image loading on error
    } finally {
      // setSubmitting(false); // NO, only for video generation
    }
  };

  const handleConfirm = async () => {
    if (!project || !editedVideoPrompt) return;

    setSubmitting(true);
    try {
      // Reconstruct the full generated_prompts object with the edited scene prompt and image prompt
      const updatedGeneratedPrompts = {
        ...project.generated_prompts,
        image_prompt: editedImagePrompt, // Include the edited image prompt
        scenes: project.generated_prompts?.scenes.map((scene, index) => {
          // Assuming we only edit the first (and likely only) scene for character ads
          if (index === activeSceneIndex) {
            return { ...scene, prompt: editedVideoPrompt };
          }
          return scene;
        })
      };

      await onConfirmGeneration(projectId, updatedGeneratedPrompts);
      // showSuccess('Video generation started!'); // Handled by parent
      // onRefetchProjectStatus(projectId); // Refresh status in parent // Done by onConfirmGeneration now
      // onClose(); // Handled by parent usually, but safe to keep
    } catch (error) {
      console.error('Error confirming generation:', error);
      // showError handled by parent
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Panel */}
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <motion.div
                className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Review & Edit Character Ad
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <p>Loading project details...</p>
                    </div>
                  ) : !project ? (
                    <div className="flex flex-col items-center justify-center h-64 text-red-500">
                      <p>Failed to load project details.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                      {/* Left Column: Generated Image */}
                      <div className="space-y-4">
                        <h4 className="sr-only">Generated Cover Image</h4> {/* Screen reader only */}
                        <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                          {project.generated_image_url ? (
                            <Image
                              src={project.generated_image_url}
                              alt="Generated Cover"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            !isRegeneratingImage && (
                              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                No image generated yet
                              </div>
                            )
                          )}
                          {isRegeneratingImage && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800 bg-opacity-75 text-white p-4">
                              <Loader2 className="w-8 h-8 animate-spin mb-2" />
                              <p className="text-sm text-center">Regenerating image...</p>
                              <p className="text-xs text-center mt-1">This may take a moment.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Prompts Section */}
                      <div className="space-y-6 flex flex-col h-full overflow-y-auto">
                        {/* Image Prompt Section */}
                        <div className="space-y-2 flex-shrink-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">Image Prompt</h4>
                            <button
                              type="button"
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={submitting}
                              onClick={handleRegenerateImageClick}
                            >
                              <Sparkles className="w-3 h-3" />
                              Regenerate Image
                            </button>
                          </div>
                          <textarea
                            id="image_prompt_editor"
                            rows={4}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm resize-none p-2"
                            value={editedImagePrompt}
                            onChange={(e) => handleImagePromptChange(e.target.value)}
                            placeholder="Describe the image you want..."
                          />
                        </div>

                        {/* Video Prompt Editor */}
                        <div className="flex-1 flex flex-col min-h-0">
                          <h4 className="text-sm font-medium text-gray-900 flex-shrink-0">Video Prompts</h4>
                          <p className="text-xs text-gray-500 mt-1 flex-shrink-0">
                            Fine-tune the AI instructions for each video segment.
                          </p>
                          
                          {/* Scene Selector/Accordion (for single scene for now) */}
                          <div className="flex-1 overflow-y-auto pr-2 space-y-4 mt-4">
                            {/* For Character Ads, assume only one scene for now, expand by default */}
                            <div className="rounded-lg border border-gray-200 bg-gray-50/70 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setIsSceneExpanded(!isSceneExpanded)}
                                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 transition-colors"
                              >
                                <div className="flex items-center gap-2 font-medium text-gray-800">
                                  <Sparkles className="w-4 h-4 text-blue-500" />
                                  Scene 1 Prompt
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isSceneExpanded ? 'transform rotate-180' : ''}`} />
                              </button>
                              
                              {isSceneExpanded && (
                                <div className="p-3 pt-0 space-y-3 border-t border-gray-100">
                                  <div className="mt-3 space-y-3">
                                    {editedVideoPrompt && FIELD_ORDER.map((field) => (
                                      <div key={field} className="space-y-1.5">
                                        <label htmlFor={`video_field_${field}`} className="block text-xs font-medium text-gray-700 uppercase tracking-wide">
                                          {FIELD_LABELS[field]}
                                        </label>
                                        <textarea
                                          id={`video_field_${field}`}
                                          rows={field === 'dialog' ? 3 : 2}
                                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm resize-none"
                                          value={editedVideoPrompt[field] || ''}
                                          onChange={(e) => handleFieldChange(field, e.target.value)}
                                          placeholder={`Enter ${FIELD_LABELS[field].toLowerCase()}...`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer - Fixed */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={submitting || loading || !project}
                    className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting Generation...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Confirm & Generate Video
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
