'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown,
  Check,
  Plus,
  Home,
  User,
  Lock,
  Coins,
  Sparkles,
  Play,
  Layers
} from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import FeedbackWidget from '@/components/FeedbackWidget';
import { CREDIT_COSTS, canAffordModel, getAutoModeSelection, getProcessingTime } from '@/lib/constants';

interface SidebarProps {
  credits?: number;
  selectedModel?: 'auto' | 'veo3' | 'veo3_fast';
  onModelChange?: (model: 'auto' | 'veo3' | 'veo3_fast') => void;
  userEmail?: string;
  userImageUrl?: string;
}

const navigation = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: Home
  },
  {
    name: 'Authentic Product Ads',
    href: '/dashboard/generate',
    icon: Sparkles
  },
  {
    name: 'Creative Ad Variations',
    href: '/dashboard/generate-v2',
    icon: Layers,
    
  },
  {
    name: 'My Ads',
    href: '/dashboard/videos',
    icon: Play
  },
  {
    name: 'Account',
    href: '/dashboard/account',
    icon: User
  }
];

export default function Sidebar({ credits = 0, selectedModel, onModelChange, userEmail, userImageUrl }: SidebarProps) {
  // Model options for dropdown with credit costs and processing times
  const getModelOptions = () => {
    const autoSelection = getAutoModeSelection(credits);
    return [
      { 
        value: 'auto', 
        label: 'Auto', 
        description: '',
        cost: autoSelection ? CREDIT_COSTS[autoSelection] : CREDIT_COSTS.veo3_fast,
        processingTime: autoSelection ? getProcessingTime(autoSelection) : '2-3 min',
        affordable: canAffordModel(credits, 'auto'),
        showCost: !!autoSelection
      },
      { 
        value: 'veo3', 
        label: 'VEO3 High', 
        description: '',
        cost: CREDIT_COSTS.veo3,
        processingTime: getProcessingTime('veo3'),
        affordable: canAffordModel(credits, 'veo3'),
        showCost: true
      },
      { 
        value: 'veo3_fast', 
        label: 'VEO3 Fast', 
        description: '',
        cost: CREDIT_COSTS.veo3_fast,
        processingTime: getProcessingTime('veo3_fast'),
        affordable: canAffordModel(credits, 'veo3_fast'),
        showCost: true
      }
    ];
  };
  
  const modelOptions = getModelOptions();
  const pathname = usePathname();
  
  // Custom dropdown state
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Persisted model selection
  const [internalModel, setInternalModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');
  const modelToUse: 'auto' | 'veo3' | 'veo3_fast' = selectedModel ?? internalModel;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const selectedOption = modelOptions.find(opt => opt.value === modelToUse);
  
  const handleOptionSelect = (value: 'auto' | 'veo3' | 'veo3_fast', affordable: boolean) => {
    if (!affordable) return; // Prevent selection of unaffordable options
    onModelChange?.(value);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flowtra_video_model', value);
      }
    } catch {}
    setInternalModel(value);
    setIsOpen(false);
  };

  // Initialize from localStorage once on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('flowtra_video_model') as 'auto' | 'veo3' | 'veo3_fast' | null;
        if (stored === 'auto' || stored === 'veo3' || stored === 'veo3_fast') {
          setInternalModel(stored);
          if (onModelChange && selectedModel !== stored) {
            onModelChange(stored);
          }
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep internal state in sync if parent controls it
  useEffect(() => {
    if (selectedModel) {
      setInternalModel(selectedModel);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('flowtra_video_model', selectedModel);
        }
      } catch {}
    }
  }, [selectedModel]);

  return (
    <div className="w-64 bg-white border-r border-gray-300 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 flex-1">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 mb-8 group">
          <Image 
            src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/logo.png" 
            alt="Flowtra Logo" 
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Flowtra</span>
        </Link>

        {/* User Info */}
        {userEmail && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {userImageUrl ? (
                  <Image 
                    src={userImageUrl} 
                    alt="User avatar" 
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Model Selection */}
        <div className="mb-6" ref={dropdownRef}>
          <label className="block text-sm font-medium text-gray-900 mb-3">
            Video Model
          </label>
          <div className="relative">
            {/* Custom Dropdown Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
            >
              <span className="font-medium">{selectedOption?.label}</span>
              <div className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
                <ChevronDown className="h-3 w-3 text-gray-600" />
              </div>
            </button>
            
            {/* Custom Dropdown Options */}
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md overflow-hidden z-50">
                {modelOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleOptionSelect(option.value as 'auto' | 'veo3' | 'veo3_fast', option.affordable)}
                    disabled={!option.affordable}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between",
                      !option.affordable 
                        ? "cursor-not-allowed opacity-50 bg-gray-50" 
                        : "hover:bg-gray-100 cursor-pointer",
                      modelToUse === option.value 
                        ? "bg-gray-100 text-gray-900" 
                        : "text-gray-700"
                    )}
                  >
                    <div className="flex items-center justify-between flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        {!option.affordable && (
                          <Lock className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                      {option.showCost && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs font-medium",
                          option.affordable ? "text-gray-600" : "text-red-500"
                        )}>
                          <Coins className="w-3 h-3" />
                          <span>{option.cost}</span>
                        </div>
                      )}
                    </div>
                    {modelToUse === option.value && option.affordable && (
                      <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Removed summary of cost/time beneath model selector per request */}
        </div>
        
        {/* Credits Display */}
        {credits !== undefined && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center shadow-sm">
                  <Coins className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-900">Credits</span>
              </div>
              <Link 
                href="/pricing"
                className="w-8 h-8 bg-gray-900 hover:bg-gray-800 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                title="Buy more credits"
              >
                <Plus className="w-4 h-4 text-white" />
              </Link>
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">{credits.toLocaleString()}</div>
          </div>
        )}

        {/* Navigation */}
        <LayoutGroup>
          <nav className="space-y-1 relative">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 overflow-hidden',
                    isActive ? 'text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebarActive"
                      className="absolute inset-0 rounded-lg bg-gray-900 shadow shadow-gray-900/25"
                      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    />
                  )}
                  <item.icon className={cn(
                    'relative z-10 w-4 h-4 transition-colors duration-150',
                    isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                  )} />
                  <span className="relative z-10 flex-1">{item.name}</span>
                  {('badge' in item) && (
                    <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {(item as { badge: string }).badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
      </div>
      
      {/* Feedback and Navigation */}
      <div className="p-6 border-t border-gray-200 space-y-2">
        <FeedbackWidget />
        <Link 
          href="/"
          className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors font-medium"
        >
          <Home className="w-5 h-5" />
          <span>Back to Landing</span>
        </Link>
      </div>
    </div>
  );
}
