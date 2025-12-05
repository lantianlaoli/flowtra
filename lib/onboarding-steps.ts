export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetId?: string; // data-onboarding-id attribute of target element
  placement?: 'top' | 'bottom' | 'left' | 'right';
  allowSkip?: boolean;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Flowtra',
    description: 'Let\'s take a quick tour of Flowtra\'s core features. This guide will help you get started creating your first AI-powered ad videos in minutes.',
    placement: 'bottom',
    allowSkip: true,
  },
  {
    id: 'home',
    title: 'Home',
    description: 'Your dashboard shows all your stats at a glance: total videos created, monthly ads, credits used, and time saved. Browse all your generated content here.',
    targetId: 'sidebar-home',
    placement: 'right',
  },
  {
    id: 'competitor-ugc-replication',
    title: 'Competitor UGC Replication',
    description: 'Clone top-performing UGC concepts from a single product image. Generate replica photos, segmented scripts, and Veo/Sora/Kling clips in minutes.',
    targetId: 'sidebar-competitor-ugc-replication',
    placement: 'right',
  },
  {
    id: 'character-ads',
    title: 'Character Ads',
    description: 'Create character-based advertising content. Let virtual characters promote your products, adding personality and engagement to your ads.',
    targetId: 'sidebar-character-ads',
    placement: 'right',
  },
  {
    id: 'watermark-removal',
    title: 'Watermark Removal',
    description: 'Remove watermarks from Sora2-generated videos using AI technology. Perfect for cleaning up content and making your videos more professional and polished.',
    targetId: 'sidebar-watermark',
    placement: 'right',
  },
  {
    id: 'my-ads',
    title: 'My Ads',
    description: 'View all your ad history including Competitor UGC Replication, character ads, and watermark removal jobs. Easily manage and download all your creations in one place.',
    targetId: 'sidebar-my-ads',
    placement: 'right',
  },
  {
    id: 'assets',
    title: 'Assets - Essential First Step!',
    description: 'You must create your first brand and add products here before you can generate any ads. This is the essential starting point - set up your brand assets now to unlock all ad creation features.',
    targetId: 'sidebar-assets',
    placement: 'right',
  },
  {
    id: 'account',
    title: 'Account',
    description: 'Manage your account information, view usage statistics, and configure your personal settings. You\'re all set to start creating amazing ads!',
    targetId: 'sidebar-account',
    placement: 'right',
  },
];

export const TOTAL_STEPS = onboardingSteps.length;
