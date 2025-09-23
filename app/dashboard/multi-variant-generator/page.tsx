import { Metadata } from 'next';
import MultiVariantGeneratorPage from '@/components/pages/MultiVariantGeneratorPage';

export const metadata: Metadata = {
  title: 'Multi-Variant Generator - Flowtra',
  description: 'Create multiple ad variations with AI - Generate unlimited previews, pay only for downloads',
};

export default function MultiVariantGeneratorPageRoute() {
  return <MultiVariantGeneratorPage />;
}