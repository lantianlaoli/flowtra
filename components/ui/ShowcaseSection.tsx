'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import VideoPlayer from './VideoPlayer';

interface ShowcaseItem {
  id: string;
  original_image_url: string;
  cover_image_url: string;
  user_id: string;
  user: {
    name: string;
    avatar: string;
  };
  // Character ads specific fields
  person_image_url?: string;
  product_image_url?: string;
  video_url?: string;
}

interface ShowcaseSectionProps {
  workflowType: 'standard-ads' | 'multi-variant-ads' | 'character-ads';
  className?: string;
}

interface ProjectItem {
  id: string;
  status: string;
  cover_image_url: string;
  original_image_url: string;
  user_id: string;
  // Character ads specific fields
  person_image_urls?: string[];
  product_image_urls?: string[];
  generated_video_urls?: string[];
  merged_video_url?: string;
}

interface UserData {
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
}

export default function ShowcaseSection({ workflowType, className = '' }: ShowcaseSectionProps) {
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShowcaseItems = async () => {
      try {
        setLoading(true);
        
        // Fetch data from the real API
        const response = await fetch(`/api/${workflowType}/history?limit=6`);
        if (response.ok) {
          const result = await response.json();
          const projects = result.data || result.history || [];
          
          // Filter for completed items with cover images
          const completedItems = projects.filter((item: ProjectItem) => 
            item.status === 'completed' && item.cover_image_url
          );
          
          // Get unique user IDs to fetch user information
           const userIds = [...new Set(completedItems.map((item: ProjectItem) => item.user_id))] as string[];
           
           // Fetch user information from Clerk
           const userInfoPromises = userIds.map(async (userId: string) => {
            try {
              const userResponse = await fetch(`/api/users/${userId}`);
              if (userResponse.ok) {
                const userData: UserData = await userResponse.json();
                return {
                  id: userId,
                  name: userData.firstName && userData.lastName 
                    ? `${userData.firstName} ${userData.lastName}`
                    : userData.firstName || userData.username || 'Anonymous User',
                  avatar: userData.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName || 'User')}&background=000000&color=fff`
                };
              }
            } catch (error) {
              console.error(`Failed to fetch user ${userId}:`, error);
            }
            return {
              id: userId,
              name: 'Anonymous User',
              avatar: 'https://ui-avatars.com/api/?name=User&background=000000&color=fff'
            };
          });
          
          const userInfos = await Promise.all(userInfoPromises);
          const userMap = new Map(userInfos.map(user => [user.id, user]));
          
          // Combine project data with user information
          const showcaseData = completedItems.slice(0, 2).map((item: ProjectItem) => {
            const baseItem = {
              id: item.id,
              original_image_url: item.original_image_url,
              cover_image_url: item.cover_image_url,
              user_id: item.user_id,
              user: userMap.get(item.user_id) || {
                name: 'Anonymous User',
                avatar: 'https://ui-avatars.com/api/?name=User&background=000000&color=fff'
              }
            };

            // Add character-ads specific data
            if (workflowType === 'character-ads') {
              return {
                ...baseItem,
                person_image_url: item.person_image_urls?.[0] || item.original_image_url,
                product_image_url: item.product_image_urls?.[0],
                video_url: item.merged_video_url || item.generated_video_urls?.[0]
              };
            }

            return baseItem;
          });
          
          setShowcaseItems(showcaseData);
        }
      } catch (error) {
        console.error('Failed to fetch showcase items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShowcaseItems();
  }, [workflowType]);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
        {[...Array(3)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-square bg-gray-200 rounded-md"></div>
              <div className="aspect-square bg-gray-200 rounded-md"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (showcaseItems.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500">No showcase items available yet.</p>
      </div>
    );
  }

  // Render character-ads specific layout
  if (workflowType === 'character-ads') {
    return (
      <div className={`space-y-8 ${className}`}>
        {showcaseItems.map((item) => (
          <div key={item.id} className="bg-gray-50 rounded-lg border border-gray-200 p-8 hover:bg-gray-100 transition-all duration-200 relative">
            {/* User info */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 relative rounded-full overflow-hidden bg-gray-200">
                <Image
                  src={item.user.avatar || '/default-avatar.png'}
                  alt={item.user.name || 'User'}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-sm font-medium text-gray-900">{item.user.name || 'Anonymous'}</span>
            </div>
            
            {/* Process flow: Person + Product → Video */}
            <div className="flex items-center justify-center gap-8 lg:gap-12">
              {/* Person Image */}
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 lg:w-36 lg:h-36 rounded-md overflow-hidden bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
                  {item.person_image_url && (
                    <Image
                      src={item.person_image_url}
                      alt="Person"
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded font-medium">
                    1
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-sm font-medium text-gray-900">Person</p>
                </div>
              </div>
              
              {/* Plus Icon */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  +
                </div>
                <p className="text-xs text-gray-500 mt-2 font-medium">Combine</p>
              </div>
              
              {/* Product Image */}
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 lg:w-36 lg:h-36 rounded-md overflow-hidden bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
                  {item.product_image_url && (
                    <Image
                      src={item.product_image_url}
                      alt="Product"
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded font-medium">
                    2
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-sm font-medium text-gray-900">Product</p>
                </div>
              </div>
              
              {/* Arrow */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 mt-2 font-medium">Generate</p>
              </div>
              
              {/* Generated Video */}
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 lg:w-36 lg:h-36 rounded-md overflow-hidden bg-white shadow-sm border border-gray-200 hover:border-gray-300 transition-colors">
                  {item.video_url ? (
                    <VideoPlayer
                      src={item.video_url}
                      className="w-full h-full object-cover"
                      autoPlay={false}
                      loop={true}
                      showControls={false}
                      ariaLabel="Generated video advertisement"
                    />
                  ) : item.cover_image_url ? (
                    <Image
                      src={item.cover_image_url}
                      alt="Generated Result"
                      fill
                      className="object-cover"
                    />
                  ) : null}
                  
                  <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded font-medium z-10">
                    3
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-sm font-medium text-gray-900">Video</p>
                  {item.video_url && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">Hover to play</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default layout for other workflow types
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${className}`}>
      {showcaseItems.map((item) => (
        <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:bg-gray-50 transition-all duration-200 relative">
          {/* User info in top-left corner */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-md p-2 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 relative rounded-full overflow-hidden bg-gray-100">
                <Image
                  src={item.user.avatar || '/default-avatar.png'}
                  alt={item.user.name || 'User'}
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-xs font-medium text-gray-700">{item.user.name || 'Anonymous'}</span>
            </div>
          </div>
          
          {/* Large before/after images */}
          <div className="grid grid-cols-2 gap-4 h-72">
            <div className="relative rounded-md overflow-hidden bg-gray-100">
              <Image
                src={item.original_image_url}
                alt="Original"
                fill
                className="object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Before
              </div>
            </div>
            <div className="relative rounded-md overflow-hidden bg-gray-100">
              <Image
                src={item.cover_image_url}
                alt="Generated"
                fill
                className="object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                After
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}