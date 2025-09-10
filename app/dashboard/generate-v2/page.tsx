import { Metadata } from 'next';
import GenerateAdPageV2 from '@/components/pages/GenerateAdPageV2';

export const metadata: Metadata = {
  title: 'Generate Ads v2 - Flowtra',
  description: 'Create multiple ad variations with AI - Generate unlimited previews, pay only for downloads',
};

export default function GenerateV2Page() {
  return <GenerateAdPageV2 />;
}
