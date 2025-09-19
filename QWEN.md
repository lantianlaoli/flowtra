# Flowtra Project Context

## Project Overview

Flowtra is a modern Next.js 15 application designed for small businesses, Etsy sellers, makers, and creators to generate AI-powered video advertisements from product photos. The platform offers an affordable solution for creating professional video ads in under a minute, starting at under $1 per video.

Key technologies used:
- Next.js 15 with App Router
- React 19
- TypeScript with strict mode
- TailwindCSS v4 with dark mode support
- Supabase for database and authentication
- Clerk for user authentication
- Vercel for analytics and speed insights

## Project Structure

```
flowtra/
├── app/                 # Next.js App Router pages and layouts
├── components/          # React components
├── contexts/            # React contexts (e.g., CreditsContext)
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and configurations
├── public/              # Static assets
├── capture/             # Likely related to video/image capture functionality
├── supabase/            # Supabase related files
├── middleware.ts        # Clerk authentication middleware
├── next.config.ts       # Next.js configuration
└── ...
```

## Building and Running

### Prerequisites
- Node.js (version not specified, but compatible with Next.js 15)
- pnpm package manager

### Environment Variables
The following environment variables are required (see `.env.example` for details):
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Your Supabase publishable default key
- Clerk authentication keys (not explicitly listed but required by middleware)

### Development Commands
- `pnpm install` - Install dependencies
- `pnpm dev` - Start development server with Turbopack
- `pnpm dev:webpack` - Start development server with Webpack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking

### Testing
- Uses Playwright for end-to-end testing (as indicated by `@playwright/test` in devDependencies)
- Run tests with `pnpm test` (if script exists) or directly with Playwright commands

## Development Conventions

### Code Style
- TypeScript with strict mode enabled
- ESLint with Next.js core-web-vitals and TypeScript rules
- TailwindCSS for styling with v4 features

### Authentication
- Uses Clerk for user authentication
- Protected routes are defined in `middleware.ts`
- User initialization and credit management are handled in `components/UserInitializer.tsx`

### State Management
- React Context API for global state (e.g., CreditsContext)
- Custom hooks for encapsulating logic (e.g., `hooks/` directory)

### API Routes
- API routes are protected using Clerk middleware
- Credit checking and management through `/api/credits/*` endpoints

### Performance Optimization
- Image optimization with Next.js Image component (configured in `next.config.ts`)
- Code splitting and optimization for external packages (lucide-react, heroicons, react-icons)
- Caching headers for static assets, fonts, CSS, and JS files
- Vercel Analytics and Speed Insights integration

### SEO and Metadata
- Comprehensive metadata configuration in `app/layout.tsx`
- Open Graph and Twitter card configurations
- Structured data (JSON-LD) for improved SEO