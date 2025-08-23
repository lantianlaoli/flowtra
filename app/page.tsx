export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-24">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-6xl font-bold mb-8 text-foreground">
          Welcome to Flowtra
        </h1>
        <p className="text-xl text-foreground/70 mb-12">
          A modern Next.js application with Supabase integration
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 border border-foreground/20 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Next.js 15</h2>
            <p className="text-foreground/70">
              Built with the latest Next.js App Router and React 19
            </p>
          </div>
          <div className="p-6 border border-foreground/20 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Supabase</h2>
            <p className="text-foreground/70">
              Ready for database integration and authentication
            </p>
          </div>
          <div className="p-6 border border-foreground/20 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">TailwindCSS v4</h2>
            <p className="text-foreground/70">
              Modern styling with dark mode support
            </p>
          </div>
          <div className="p-6 border border-foreground/20 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">TypeScript</h2>
            <p className="text-foreground/70">
              Type-safe development with strict mode enabled
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}