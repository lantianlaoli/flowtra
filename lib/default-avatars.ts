export type SystemAvatar = {
  id: string;
  avatar_name: string;
  photo_url: string;
  created_at: string;
  updated_at: string;
  isSystem: true;
};

export const SYSTEM_AVATARS: SystemAvatar[] = [
  {
    id: 'system-default-male',
    avatar_name: 'Default Male',
    photo_url: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/avatars/user_default_male.png',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    isSystem: true
  },
  {
    id: 'system-default-female',
    avatar_name: 'Default Female',
    photo_url: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/avatars/user_default_female.png',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    isSystem: true
  },
  {
    id: 'system-default-founder',
    avatar_name: 'Default Founder',
    photo_url: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/defaults/avatars/user_default_founder.png',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    isSystem: true
  }
];
