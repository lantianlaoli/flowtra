import PricingSection from '@/components/pages/landing/sections/PricingSection';

export default function PricingPreviewPage() {
  return (
    <div className="min-h-screen bg-white py-20">
      <div className="max-w-[1280px] mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-4">Pricing Preview</h1>
        <p className="text-center text-gray-600 mb-12">Development preview for pricing cards including the new Demo Contact Card</p>

        <PricingSection showTitle={true} />
      </div>
    </div>
  );
}
