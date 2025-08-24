import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Join Flowtra</h2>
          <p className="mt-2 text-gray-600">Start creating professional AI advertisements today</p>
        </div>
        <SignUp 
          afterSignUpUrl="/dashboard"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              formButtonPrimary: 
                "bg-gray-900 hover:bg-gray-800 text-white",
              card: "shadow-lg border border-gray-200",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
            }
          }}
        />
      </div>
    </div>
  )
}