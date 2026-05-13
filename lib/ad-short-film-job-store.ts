export type AdShortFilmJobStatus =
  | 'idle'
  | 'uploading'
  | 'generating_storyboard'
  | 'generating_storyboard_image'
  | 'generating_video'
  | 'completed'
  | 'failed';

export type AdShortFilmJob = {
  id: string;
  userId: string;
  status: AdShortFilmJobStatus;
  productImageUrl: string | null;
  storyboardPrompt: string;
  storyboardImageUrl: string | null;
  storyboardImageTaskId: string | null;
  videoUrl: string | null;
  videoTaskId: string | null;
  errorMessage: string | null;
  billedCredits: number;
  billingRefundedAt: string | null;
  createdAt: number;
  updatedAt: number;
};

// In-memory job store - note: jobs are lost on server restart
const jobStore = new Map<string, AdShortFilmJob>();

export function generateJobId(): string {
  return `adshort_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function addJob(job: AdShortFilmJob): void {
  jobStore.set(job.id, job);
}

export function getJob(jobId: string): AdShortFilmJob | undefined {
  return jobStore.get(jobId);
}

export function updateJob(
  jobId: string,
  updates: Partial<
    Pick<
      AdShortFilmJob,
      | 'status'
      | 'productImageUrl'
      | 'storyboardPrompt'
      | 'storyboardImageUrl'
      | 'storyboardImageTaskId'
      | 'videoUrl'
      | 'videoTaskId'
      | 'errorMessage'
      | 'billingRefundedAt'
    >
  >
): void {
  const job = jobStore.get(jobId);
  if (job) {
    Object.assign(job, updates, { updatedAt: Date.now() });
    jobStore.set(jobId, job);
  }
}

export function getJobsByUserId(userId: string): AdShortFilmJob[] {
  return Array.from(jobStore.values()).filter((job) => job.userId === userId);
}

export function deleteJob(jobId: string): boolean {
  return jobStore.delete(jobId);
}
