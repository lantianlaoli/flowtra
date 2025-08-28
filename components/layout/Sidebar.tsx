'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  History, 
  CreditCard, 
  Zap,
  ChevronDown,
  Check,
  Sparkles,
  Plus,
  Home,
  User,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FeedbackWidget from '@/components/FeedbackWidget';
import { CREDIT_COSTS, canAffordModel, getAutoModeSelection } from '@/lib/constants';

interface SidebarProps {
  credits?: number;
  selectedModel?: 'auto' | 'veo3' | 'veo3_fast';
  onModelChange?: (model: 'auto' | 'veo3' | 'veo3_fast') => void;
  userEmail?: string;
  userImageUrl?: string;
}

const navigation = [
  {
    name: 'Upload Product Photo',
    href: '/dashboard',
    icon: Upload
  },
  {
    name: 'History',
    href: '/dashboard/history',
    icon: History
  },
  {
    name: 'Credits',
    href: '/dashboard/credits',
    icon: CreditCard
  }
];

export default function Sidebar({ credits = 0, selectedModel = 'auto', onModelChange, userEmail, userImageUrl }: SidebarProps) {
  // Model options for dropdown with credit costs
  const getModelOptions = () => {
    const autoSelection = getAutoModeSelection(credits);
    return [
      { 
        value: 'auto', 
        label: 'Auto', 
        description: '',
        cost: autoSelection ? CREDIT_COSTS[autoSelection] : CREDIT_COSTS.veo3_fast,
        affordable: canAffordModel(credits, 'auto'),
        showCost: !!autoSelection
      },
      { 
        value: 'veo3', 
        label: 'VEO3 High Quality', 
        description: '',
        cost: CREDIT_COSTS.veo3,
        affordable: canAffordModel(credits, 'veo3'),
        showCost: true
      },
      { 
        value: 'veo3_fast', 
        label: 'VEO3 Fast', 
        description: '',
        cost: CREDIT_COSTS.veo3_fast,
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
  
  const selectedOption = modelOptions.find(opt => opt.value === selectedModel);
  
  const handleOptionSelect = (value: 'auto' | 'veo3' | 'veo3_fast', affordable: boolean) => {
    if (!affordable) return; // Prevent selection of unaffordable options
    onModelChange?.(value);
    setIsOpen(false);
  };

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
                      selectedModel === option.value 
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
                        <span className={cn(
                          "text-xs font-medium",
                          option.affordable ? "text-gray-600" : "text-red-500"
                        )}>
                          {option.cost} credits
                        </span>
                      )}
                    </div>
                    {selectedModel === option.value && option.affordable && (
                      <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedOption?.showCost && (
            <div className="mt-2 flex items-center justify-center text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1.5 border border-gray-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-gray-500" />
                <span className={cn(
                  "font-medium",
                  selectedOption.affordable ? "text-gray-700" : "text-red-500"
                )}>
                  {selectedOption.cost} credits
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Credits Display */}
        {credits !== undefined && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center">
                  <Zap className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-900">Credits</span>
              </div>
              <Link 
                href="/pricing"
                className="w-6 h-6 border border-gray-300 hover:border-gray-400 rounded-md flex items-center justify-center transition-colors duration-150 hover:bg-gray-50"
                title="Buy more credits"
              >
                <Plus className="w-3.5 h-3.5 text-gray-600" />
              </Link>
            </div>
            <div className="text-xl font-semibold text-gray-900">{credits.toLocaleString()}</div>
          </div>
        )}

        {/* Navigation */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <item.icon className={cn(
                  'w-4 h-4 transition-colors duration-150',
                  isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>
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