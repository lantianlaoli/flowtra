'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/layout/Sidebar';
import { User, Bell, Shield, Palette, Download, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [userCredits, setUserCredits] = useState<number>();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    marketingEmails: false,
    videoQuality: 'veo3_fast' as 'veo3' | 'veo3_fast',
    autoSave: true,
    darkMode: false
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, user]);

  useEffect(() => {
    // TODO: Implement API call to fetch user settings
    setUserCredits(1820); // Mock data
  }, []);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  const handleSettingChange = (key: string, value: boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // TODO: Save to API
    console.log('Setting updated:', key, value);
  };

  const handleExportData = () => {
    // TODO: Implement data export
    console.log('Exporting user data...');
  };

  const handleDeleteAccount = () => {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // TODO: Implement account deletion
      console.log('Deleting account...');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar credits={userCredits} />
      
      <div className="flex-1">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Settings
            </h1>
            <p className="text-gray-600">
              Manage your account settings and preferences
            </p>
          </div>

          <div className="max-w-4xl space-y-8">
            {/* Profile Settings */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-6 h-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <img
                    src={user?.imageUrl || '/api/placeholder/64/64'}
                    alt="Profile"
                    className="w-16 h-16 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-gray-900">
                      {user?.fullName || user?.firstName || 'User'}
                    </p>
                    <p className="text-gray-600">
                      {user?.emailAddresses?.[0]?.emailAddress}
                    </p>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600">
                  Profile information is managed through your authentication provider.
                </p>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Bell className="w-6 h-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Email Notifications</p>
                    <p className="text-sm text-gray-600">Receive notifications when your ads are generated</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Marketing Emails</p>
                    <p className="text-sm text-gray-600">Receive updates about new features and offers</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.marketingEmails}
                      onChange={(e) => handleSettingChange('marketingEmails', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Generation Preferences */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Palette className="w-6 h-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Generation Preferences</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-gray-900 mb-2">
                    Default Video Quality
                  </label>
                  <select
                    value={settings.videoQuality}
                    onChange={(e) => handleSettingChange('videoQuality', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="veo3_fast">Veo3 Fast (30 credits)</option>
                    <option value="veo3">Veo3 High Quality (150 credits)</option>
                  </select>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose your preferred video generation model
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Auto-save Progress</p>
                    <p className="text-sm text-gray-600">Automatically save your work as you create ads</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoSave}
                      onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-900"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Data & Privacy */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-6 h-6 text-gray-600" />
                <h2 className="text-xl font-semibold text-gray-900">Data & Privacy</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <button
                    onClick={handleExportData}
                    className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Export My Data
                  </button>
                  <p className="text-sm text-gray-600 mt-1">
                    Download all your data including generated ads and usage history
                  </p>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white border border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Trash2 className="w-6 h-6 text-red-600" />
                <h2 className="text-xl font-semibold text-red-900">Danger Zone</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <button
                    onClick={handleDeleteAccount}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete Account
                  </button>
                  <p className="text-sm text-red-600 mt-2">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}