# Flowtra

A modern Next.js application built with Supabase integration.

## Tech Stack

- **Next.js 15** with App Router
- **React 19**
- **TypeScript** with strict mode
- **TailwindCSS v4** with dark mode support
- **Supabase** for database and authentication
- **ESLint** for code linting

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Start the development server:
```bash
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking

## Environment Variables

The following environment variables are required:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Your Supabase publishable default key

## Project Structure

```
flowtra/
├── app/                 # Next.js App Router pages
├── components/          # React components
├── lib/                # Utility functions and configurations
├── hooks/              # Custom React hooks
├── public/             # Static assets
└── ...
```