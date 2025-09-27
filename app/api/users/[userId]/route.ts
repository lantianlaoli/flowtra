import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';

// Function to extract meaningful information from user_id
function extractUserInfoFromId(userId: string) {
  // Try to extract email domain or other meaningful info from user_id
  // Clerk user IDs often contain encoded information
  
  // If the user_id contains recognizable patterns, extract them
  // For now, we'll create a more friendly display name based on the user_id
  const shortId = userId.replace('user_', '').substring(0, 8);
  
  return {
    displayName: `User ${shortId}`,
    shortId: shortId
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch user information from Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return user information
    return NextResponse.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      imageUrl: user.imageUrl,
      emailAddresses: user.emailAddresses.map((email: { emailAddress: string }) => email.emailAddress)
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    
    // If user not found in Clerk, return a more informative default user object
    // This handles cases where users were deleted from Clerk but data remains in database
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
      const userInfo = extractUserInfoFromId((await params).userId);
      
      return NextResponse.json({
        id: (await params).userId,
        firstName: userInfo.displayName,
        lastName: '',
        username: `user_${userInfo.shortId}`,
        imageUrl: null,
        emailAddresses: [],
        isDeleted: true // Flag to indicate this user was deleted from Clerk
      });
    }
    
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}