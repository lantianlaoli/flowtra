import LandingPage from '@/components/pages/LandingPage';
import StructuredData from '@/components/seo/StructuredData';

// Revalidate every hour to update user count
export const revalidate = 3600;

export default function Home() {
  return (
    <>
      <StructuredData />
      <LandingPage />
    </>
  );
}
