export type ImageCloneJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ImageCloneJob = {
  id: string;
  userId: string;
  status: ImageCloneJobStatus;
  productImageUrl: string | null;
  referenceImageUrls: string[];
  prompt: string;
  aspectRatio: string;
  resolution: string;
  kieTaskId: string | null;
  resultImageUrl: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
};

// In-memory job store - note: jobs are lost on server restart
const jobStore = new Map<string, ImageCloneJob>();

export function generateJobId(): string {
  return `imgclone_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function addJob(job: ImageCloneJob): void {
  jobStore.set(job.id, job);
}

export function getJob(jobId: string): ImageCloneJob | undefined {
  return jobStore.get(jobId);
}

export function updateJob(
  jobId: string,
  updates: Partial<Pick<ImageCloneJob, 'status' | 'kieTaskId' | 'resultImageUrl' | 'errorMessage' | 'prompt'>>
): void {
  const job = jobStore.get(jobId);
  if (job) {
    Object.assign(job, updates, { updatedAt: Date.now() });
    jobStore.set(jobId, job);
  }
}

export function getJobsByUserId(userId: string): ImageCloneJob[] {
  return Array.from(jobStore.values()).filter((job) => job.userId === userId);
}

export function deleteJob(jobId: string): boolean {
  return jobStore.delete(jobId);
}
