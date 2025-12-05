/**
 * Landing Page Static Data
 *
 * Extracted from LandingPage.tsx to reduce component bundle size
 * and improve code maintainability.
 */

export interface SuccessCaseContent {
  inputImage?: string;
  characterImage?: string;
  productImage?: string;
  videoUrl: string;
}

export interface SuccessCase {
  id: string;
  user: string;
  avatar: string;
  quote: string;
  tiktokUrl: string;
  tiktokText: string;
  layout: 'input-to-output' | 'multi-input-to-output';
  content: SuccessCaseContent;
}

export const successCases: SuccessCase[] = [
  {
    id: 'competitor-ugc-replication',
    user: '@cheerslinkou',
    avatar: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_avatar_1.jpg',
    quote: 'Flowtra turned my product photo into a professional ad video that showcases quality perfectly.',
    tiktokUrl: 'https://www.tiktok.com/@cheerslinkou/video/7543405624797990150',
    tiktokText: 'See the Result',
    layout: 'input-to-output',
    content: {
      inputImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_standard_product_1.jpg',
      videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_standard_case_1.mp4'
    }
  },
  {
    id: 'character-ads',
    user: '@cheerslinkou',
    avatar: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_avatar_1.jpg',
    quote: 'Amazing! Flowtra combined character with the product to create a personalized video ad that feels authentic and engaging.',
    tiktokUrl: 'https://www.tiktok.com/@cheerslinkou/video/7554347579723517195?lang=en',
    tiktokText: 'See the Magic',
    layout: 'multi-input-to-output',
    content: {
      characterImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_character_human_case_1.png',
      productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_character_product_case_1.jpg',
      videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_character_video_case_1.mp4'
    }
  }
];

// Demo video schemas for SEO
export interface DemoVideo {
  videoUrl: string;
  title: string;
  description: string;
}

export const demoVideos: DemoVideo[] = [
  {
    videoUrl: 'https://tempfile.aiquickdraw.com/p/bdbf3c847dd219aea0775162c9c77415_1756176082.mp4',
    title: 'AI Video Ad Generator Demo - Product Photo to Advertisement',
    description: 'See how Flowtra transforms a simple product photo into professional video advertisements for Amazon, Walmart, and local stores using AI technology'
  },
  {
    videoUrl: 'https://tempfile.aiquickdraw.com/p/d51126ac584cea6e6916851b6e6ace9d_1756336008.mp4',
    title: 'E-commerce Product AI Video Advertisement Example',
    description: 'Real example of AI-generated video advertisement created from product photo for online retail marketing'
  },
  {
    videoUrl: 'https://tempfile.aiquickdraw.com/p/0fcc1f33f4dc11aa3771d75213b53bf6_1756263260.mp4',
    title: 'Local Store AI Video Ad Creation from Product Image',
    description: 'Demonstration of AI technology creating professional video advertisements for local stores from a single product photograph'
  }
];
