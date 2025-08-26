'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

interface CreditsContextType {
  credits: number | undefined;
  refetchCredits: () => Promise<void>;
  isLoading: boolean;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}

interface CreditsProviderProps {
  children: React.ReactNode;
}

export function CreditsProvider({ children }: CreditsProviderProps) {
  const { user } = useUser();
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCredits = async () => {
    if (!user?.id || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/credits/check');
      const data = await response.json();
      
      if (data.success) {
        setCredits(data.credits);
      } else {
        console.error('Failed to fetch credits:', data.error);
        setCredits(0);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      setCredits(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && credits === undefined) {
      fetchCredits();
    }
  }, [user?.id, credits]);

  const refetchCredits = async () => {
    await fetchCredits();
  };

  return (
    <CreditsContext.Provider value={{ credits, refetchCredits, isLoading }}>
      {children}
    </CreditsContext.Provider>
  );
}