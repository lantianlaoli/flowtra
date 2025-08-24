# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flowtra is an AI-powered product advertisement generator that creates both cover images and video advertisements from a single product photo upload. The application uses Supabase Storage, OpenRouter, and Kie.ai APIs to provide a complete end-to-end workflow.

## Commands

Use `pnpm` as the package manager for all operations:

- `pnpm dev` - Start development server (runs on http://localhost:3000)
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint linting
- `pnpm type-check` - Run TypeScript type checking

## Architecture

Flowtra is a Next.js 15 application with a 5-step AI workflow:

### Tech Stack
- **Framework**: Next.js 15 with React 19 and App Router
- **Storage**: Supabase Storage for image uploads
- **AI Services**: OpenRouter (Gemini 2.0 Flash Lite, GPT-4O) + Kie.ai (GPT4O-Image, VEO)
- **Styling**: TailwindCSS v4 with dark mode support
- **Icons**: Lucide React
- **TypeScript**: Strict mode enabled with path aliases (`@/*` maps to root)

### Core Workflow

1. **File Upload** (`/api/upload`) - Upload product image to Supabase Storage
2. **Image Description** (`/api/describe-image`) - OpenRouter Gemini analyzes product
3. **Prompt Generation** (`/api/generate-prompts`) - OpenRouter GPT-4O creates creative brief
4. **Cover Generation** (`/api/generate-cover`) - Kie.ai GPT4O-Image creates advertisement image
5. **Video Generation** (`/api/generate-video`) - Kie.ai VEO creates video advertisement

### Key Files

#### API Routes
- `app/api/upload/route.ts` - Handles file upload to Supabase Storage
- `app/api/describe-image/route.ts` - AI image description using OpenRouter
- `app/api/generate-prompts/route.ts` - Creative brief generation with detailed system prompt
- `app/api/generate-cover/route.ts` - Cover image generation using Kie.ai GPT4O-Image API
- `app/api/generate-video/route.ts` - Video generation using Kie.ai VEO API

#### Core Components
- `hooks/useWorkflow.ts` - State management for the 5-step workflow
- `components/FileUpload.tsx` - Drag-and-drop file upload component
- `components/StepIndicator.tsx` - Visual progress indicator
- `app/page.tsx` - Main workflow interface

#### Configuration
- `lib/supabase.ts` - Supabase client (currently minimal setup)
- `.env.example` - All required environment variables

### Environment Variables

**Required for core functionality:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (for image storage)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (for image storage)
- `OPENROUTER_API_KEY` - For AI image description and prompt generation
- `KIE_API_KEY` - For image generation and video generation

**Optional (Authentication):**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk authentication
- `CLERK_SECRET_KEY` - Clerk secret key

### Workflow State Management

The `useWorkflow` hook manages the entire process with states:
- `upload` - File upload step
- `describe` - AI product analysis
- `generate-prompts` - Creative brief generation  
- `generate-cover` - Cover image creation
- `generate-video` - Video advertisement creation
- `complete` - Final results display

### API Integration Details

#### OpenRouter Integration
- Uses Gemini 2.0 Flash Lite for product description
- Uses GPT-4O with detailed creative director system prompt for ad generation
- Structured JSON output for image and video prompts

#### Kie.ai Integration  
- GPT4O-Image API (`/api/v1/gpt4o-image/generate`) for cover generation with product placement
- VEO API (`/api/v1/veo/generate`) for video advertisement creation
- Task-based polling system for async job completion using `record-info` endpoints
- Support for multiple VEO models: veo3, veo3_fast

#### Supabase Integration
- Storage bucket `images/covers/` for product image uploads
- Public URL generation for AI processing
- Direct client-side uploads with server-side configuration