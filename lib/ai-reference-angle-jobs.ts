export type AiReferenceAngleAssetType = 'product' | 'avatar' | 'universal';

export type AiReferenceAngleJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface AiReferenceAngleJob {
  id: string;
  user_id: string;
  asset_type: AiReferenceAngleAssetType;
  source_image_url: string;
  preset_key: string;
  preset_label: string;
  kie_task_id: string;
  status: AiReferenceAngleJobStatus;
  result_image_url: string | null;
  error_message: string | null;
  webhook_received_at: string | null;
  created_at: string;
  updated_at: string;
  aspect_ratio: string | null;
  billed_credits?: number;
  billing_refunded_at?: string | null;
}

export interface AiReferenceAngleCreateJobResponse {
  id: string;
  presetKey: string;
  presetLabel: string;
  status: AiReferenceAngleJobStatus;
}
