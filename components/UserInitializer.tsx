'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { getUserCredits, initializeUserCredits } from '@/lib/credits'
import { INITIAL_FREE_CREDITS } from '@/lib/constants'
import { useCredits } from '@/contexts/CreditsContext'

export function UserInitializer() {
  const { user, isLoaded } = useUser()
  const { refetchCredits } = useCredits()
  const initializationRef = useRef(new Set<string>())

  useEffect(() => {
    const initializeUser = async (userId: string) => {
      // Check persistent storage first to prevent duplicate initializations across sessions
      const storageKey = `flowtra_credits_initialized_${userId}`
      const alreadyInitialized = localStorage.getItem(storageKey)
      
      // Prevent multiple initializations for the same user (session + persistent check)
      if (initializationRef.current.has(userId) || alreadyInitialized === 'true') {
        console.log(`👤 User ${userId} initialization already attempted, skipping`)
        return
      }
      
      try {
        initializationRef.current.add(userId)
        
        // Check if user already has credits
        const creditsResult = await getUserCredits(userId)
        
        if (creditsResult.success && !creditsResult.credits) {
          // User exists but has no credits record, create one
          console.log('🔄 Initializing credits record for new user:', userId)
          const createResult = await initializeUserCredits(userId, INITIAL_FREE_CREDITS)

          if (createResult.success) {
            console.log(`✅ Credits record initialized successfully for user: ${userId}`)
            // Mark as initialized in localStorage to prevent future attempts
            localStorage.setItem(storageKey, 'true')
            // Refresh credits in the context to update UI immediately
            await refetchCredits()
          } else {
            console.error('❌ Failed to initialize credits for user:', userId, createResult.error)
            // Don't mark as initialized if it failed
          }
        } else if (creditsResult.success && creditsResult.credits) {
          console.log('👤 User already has credits record:', userId, creditsResult.credits.credits_remaining)
          // Mark as initialized since user already has credits
          localStorage.setItem(storageKey, 'true')
        } else {
          console.error('❌ Error checking user credits:', creditsResult.error)
          // Don't mark as initialized if we couldn't check
        }
      } catch (error) {
        console.error('❌ Error during user initialization:', error)
        // Don't mark as initialized if there was an error
      }
    }

    // Only proceed if Clerk has loaded and user exists
    if (isLoaded && user?.id) {
      initializeUser(user.id)
    }
  }, [isLoaded, user?.id, refetchCredits])

  // This component renders nothing
  return null
}