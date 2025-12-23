import { createClient } from '@supabase/supabase-js';

/**
 * Cleanup Script: Remove all competitor ad video files from Supabase storage
 *
 * Purpose: Delete all files in the competitor_videos bucket after migration
 * Run this AFTER applying the database migration
 *
 * Usage:
 *   source .env.local  # Load environment variables
 *   npx tsx scripts/cleanup-competitor-videos.ts
 */

async function cleanupStorage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🗑️  Starting cleanup of competitor_videos bucket...');

  try {
    // List all files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from('competitor_videos')
      .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });

    if (listError) {
      console.error('❌ Error listing files:', listError.message);
      process.exit(1);
    }

    if (!files || files.length === 0) {
      console.log('✅ No files found in competitor_videos bucket');
      return;
    }

    console.log(`📊 Found ${files.length} files/folders to process`);

    // Delete all files recursively
    let deletedCount = 0;
    for (const file of files) {
      if (file.id) {
        // It's a file
        const deleted = await deleteFile(supabase, 'competitor_videos', file.name);
        if (deleted) deletedCount++;
      } else {
        // It's a folder - delete recursively
        const count = await deleteRecursive(supabase, 'competitor_videos', file.name);
        deletedCount += count;
      }
    }

    console.log(`✅ Successfully deleted ${deletedCount} files from competitor_videos bucket`);
    console.log('🎉 Cleanup complete!');

  } catch (error) {
    console.error('❌ Unexpected error during cleanup:', error);
    process.exit(1);
  }
}

async function deleteRecursive(
  supabase: any,
  bucket: string,
  path: string
): Promise<number> {
  let deletedCount = 0;

  // List items in this folder
  const { data: items, error: listError } = await supabase.storage
    .from(bucket)
    .list(path);

  if (listError) {
    console.warn(`⚠️  Error listing ${path}:`, listError.message);
    return 0;
  }

  if (!items || items.length === 0) {
    return 0;
  }

  // Process each item
  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    if (item.id) {
      // It's a file - delete it
      const deleted = await deleteFile(supabase, bucket, fullPath);
      if (deleted) deletedCount++;
    } else {
      // It's a folder - recurse
      const count = await deleteRecursive(supabase, bucket, fullPath);
      deletedCount += count;
    }
  }

  return deletedCount;
}

async function deleteFile(
  supabase: any,
  bucket: string,
  path: string
): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    console.warn(`⚠️  Failed to delete ${path}:`, error.message);
    return false;
  }

  console.log(`🗑️  Deleted: ${path}`);
  return true;
}

// Run cleanup
cleanupStorage().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
