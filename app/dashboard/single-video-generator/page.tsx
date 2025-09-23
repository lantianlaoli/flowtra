import { Metadata } from 'next';
import SingleVideoGeneratorPage from '@/components/pages/SingleVideoGeneratorPage';

export const metadata: Metadata = {
  title: 'Single Video Generator - Flowtra',
  description: 'Create professional video advertisements with AI - Generate single, high-quality video ads',
};

export default function SingleVideoGeneratorPageRoute() {
  return <SingleVideoGeneratorPage />;
}