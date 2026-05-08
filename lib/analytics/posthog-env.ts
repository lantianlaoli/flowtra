export function isPostHogDisabledInDevelopment() {
  return process.env.NODE_ENV === 'development'
}

export function isPostHogConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)
}

export function isPostHogEnabled() {
  return isPostHogConfigured() && !isPostHogDisabledInDevelopment()
}
