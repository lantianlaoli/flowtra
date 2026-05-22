import type {
  ToolGenerationJobStatus,
  ToolGenerationTaskStatus,
  ToolKey,
} from '@/lib/tools/job-store';
import {
  calculateEcommerceListingProgress,
  isEcommerceListingComplete,
  type EcommerceListingImageSlot,
  type EcommerceListingMetadata,
} from '@/lib/tools/ecommerce-listing-studio';

type JobLike = {
  tool_key: ToolKey;
  metadata: Record<string, unknown> | null;
};

type TaskLike = {
  metadata: Record<string, unknown> | null;
};

type SiblingTaskLike = {
  status: ToolGenerationTaskStatus;
};

export type ToolGenerationJobUpdate = {
  status?: ToolGenerationJobStatus;
  result_url?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  webhook_received_at?: string | null;
};

export function shouldCreateAdShortFilmVideoTask(input: {
  taskMetadata: Record<string, unknown> | null | undefined;
  jobMetadata: Record<string, unknown> | null | undefined;
}) {
  return (
    input.taskMetadata?.stage === 'storyboard_image' &&
    typeof input.jobMetadata?.video_task_id !== 'string'
  );
}

export function shouldCreateEcommerceListingVideoTask(input: {
  taskMetadata: Record<string, unknown> | null | undefined;
  jobMetadata: Record<string, unknown> | null | undefined;
}) {
  const metadata = input.jobMetadata as EcommerceListingMetadata | null | undefined;
  return (
    input.taskMetadata?.stage === 'storyboard_image' &&
    typeof metadata?.video?.taskId !== 'string'
  );
}

function updateEcommerceImageSlot(
  slots: EcommerceListingImageSlot[] | undefined,
  slotId: unknown,
  updates: Partial<EcommerceListingImageSlot>
) {
  return (slots ?? []).map((slot) => (slot.id === slotId ? { ...slot, ...updates } : slot));
}

export function buildEcommerceListingFailureUpdate(input: {
  job: JobLike;
  task: TaskLike;
  errorMessage: string;
  webhookReceivedAt: string;
}): ToolGenerationJobUpdate | null {
  if (input.job.tool_key !== 'ecommerce-listing-studio') return null;

  const metadata = (input.job.metadata ?? {}) as EcommerceListingMetadata;
  const taskMetadata = input.task.metadata ?? {};
  let nextMetadata: EcommerceListingMetadata = { ...metadata };

  if (taskMetadata.stage === 'image') {
    nextMetadata = {
      ...nextMetadata,
      carousel_images: updateEcommerceImageSlot(nextMetadata.carousel_images, taskMetadata.slot_id, {
        status: 'fail',
        error: input.errorMessage,
      }),
      detail_images: updateEcommerceImageSlot(nextMetadata.detail_images, taskMetadata.slot_id, {
        status: 'fail',
        error: input.errorMessage,
      }),
    };
  } else if (taskMetadata.stage === 'storyboard_image' || taskMetadata.stage === 'video') {
    nextMetadata = {
      ...nextMetadata,
      video: {
        ...(nextMetadata.video ?? { status: 'fail', prompt: '' }),
        status: 'fail',
        error: input.errorMessage,
      },
    };
  }

  const progress = calculateEcommerceListingProgress(nextMetadata);
  nextMetadata = {
    ...nextMetadata,
    completed_outputs: progress.completed,
    total_outputs: progress.total,
  };

  return {
    webhook_received_at: input.webhookReceivedAt,
    status: 'failed',
    error_message: input.errorMessage,
    metadata: nextMetadata,
  };
}

export function buildWebhookJobUpdate(input: {
  job: JobLike;
  task: TaskLike;
  resultUrl: string;
  webhookReceivedAt: string;
  siblingTasks: SiblingTaskLike[];
}): ToolGenerationJobUpdate {
  const metadata = input.job.metadata ?? {};
  const taskMetadata = input.task.metadata ?? {};
  const baseUpdate: ToolGenerationJobUpdate = {
    webhook_received_at: input.webhookReceivedAt,
  };

  if (input.job.tool_key === 'image-clone') {
    return {
      ...baseUpdate,
      status: 'completed',
      result_url: input.resultUrl,
    };
  }

  if (input.job.tool_key === 'ai-reference-angle') {
    const completedCount = input.siblingTasks.filter((task) => task.status === 'completed').length;
    const totalCount = typeof metadata.count === 'number' ? metadata.count : input.siblingTasks.length;
    return {
      ...baseUpdate,
      metadata: { ...metadata, completed_tasks: completedCount },
      ...(totalCount > 0 && completedCount >= totalCount ? { status: 'completed' as const } : {}),
    };
  }

  if (input.job.tool_key === 'image-clone-bulk') {
    const allTerminal =
      input.siblingTasks.length > 0 &&
      input.siblingTasks.every((task) => task.status === 'completed' || task.status === 'failed');
    return {
      ...baseUpdate,
      metadata: { ...metadata },
      ...(allTerminal ? { status: 'completed' as const } : {}),
    };
  }

  if (input.job.tool_key === 'ad-short-film') {
    if (taskMetadata.stage === 'storyboard_image') {
      return {
        ...baseUpdate,
        status: 'generating_video',
        metadata: { ...metadata, storyboard_image_url: input.resultUrl },
      };
    }

    if (taskMetadata.stage === 'video') {
      return {
        ...baseUpdate,
        status: 'completed',
        result_url: input.resultUrl,
        metadata: { ...metadata },
      };
    }
  }

  if (input.job.tool_key === 'ecommerce-listing-studio') {
    const ecommerceMetadata = metadata as EcommerceListingMetadata;

    if (taskMetadata.stage === 'image') {
      const nextMetadata: EcommerceListingMetadata = {
        ...ecommerceMetadata,
        carousel_images: updateEcommerceImageSlot(ecommerceMetadata.carousel_images, taskMetadata.slot_id, {
          status: 'success',
          resultUrl: input.resultUrl,
        }),
        detail_images: updateEcommerceImageSlot(ecommerceMetadata.detail_images, taskMetadata.slot_id, {
          status: 'success',
          resultUrl: input.resultUrl,
        }),
      };
      const progress = calculateEcommerceListingProgress(nextMetadata);
      nextMetadata.completed_outputs = progress.completed;
      nextMetadata.total_outputs = progress.total;
      return {
        ...baseUpdate,
        metadata: nextMetadata,
        ...(isEcommerceListingComplete(nextMetadata)
          ? { status: 'completed' as const, result_url: input.resultUrl }
          : {}),
      };
    }

    if (taskMetadata.stage === 'storyboard_image') {
      const nextMetadata: EcommerceListingMetadata = {
        ...ecommerceMetadata,
        video: {
          ...(ecommerceMetadata.video ?? { status: 'processing', prompt: '' }),
          status: 'processing',
          storyboardUrl: input.resultUrl,
        },
      };
      const progress = calculateEcommerceListingProgress(nextMetadata);
      nextMetadata.completed_outputs = progress.completed;
      nextMetadata.total_outputs = progress.total;
      return {
        ...baseUpdate,
        status: 'generating_video',
        metadata: nextMetadata,
      };
    }

    if (taskMetadata.stage === 'video') {
      const nextMetadata: EcommerceListingMetadata = {
        ...ecommerceMetadata,
        video: {
          ...(ecommerceMetadata.video ?? { status: 'success', prompt: '' }),
          status: 'success',
          resultUrl: input.resultUrl,
        },
      };
      const progress = calculateEcommerceListingProgress(nextMetadata);
      nextMetadata.completed_outputs = progress.completed;
      nextMetadata.total_outputs = progress.total;
      return {
        ...baseUpdate,
        status: isEcommerceListingComplete(nextMetadata) ? 'completed' : 'processing',
        result_url: input.resultUrl,
        metadata: nextMetadata,
      };
    }
  }

  return baseUpdate;
}
