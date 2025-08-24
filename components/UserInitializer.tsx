'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { getUserCredits, initializeUserCredits } from '@/lib/credits'
import { INITIAL_FREE_CREDITS } from '@/lib/constants'

export function UserInitializer() {
  const { user, isLoaded } = useUser()
  const initializationRef = useRef(new Set<string>())

  useEffect(() => {
    const initializeUser = async (userId: string) => {
      // Prevent multiple initializations for the same user
      if (initializationRef.current.has(userId)) {
        return
      }
      
      try {
        initializationRef.current.add(userId)
        
        // Check if user already has credits
        const creditsResult = await getUserCredits(userId)
        
        if (creditsResult.success && !creditsResult.credits) {
          // User exists but has no credits record, create one with initial free credits
          console.log('Initializing credits for new user:', userId)
          const createResult = await initializeUserCredits(userId, INITIAL_FREE_CREDITS)
          
          if (createResult.success) {
            console.log(`✅ Credits initialized successfully for user: ${userId} with ${INITIAL_FREE_CREDITS} free credits`)
          } else {
            console.error('❌ Failed to initialize credits for user:', userId, createResult.error)
          }
        } else if (creditsResult.success && creditsResult.credits) {
          console.log('User already has credits:', userId, creditsResult.credits.credits_remaining)
        } else {
          console.error('Error checking user credits:', creditsResult.error)
        }
      } catch (error) {
        console.error('❌ Error during user initialization:', error)
      }
    }

    // Only proceed if Clerk has loaded and user exists
    if (isLoaded && user?.id) {
      initializeUser(user.id)
    }
  }, [isLoaded, user?.id])

  // This component renders nothing
  return null
}