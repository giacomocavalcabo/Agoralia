import { z } from 'zod'

// Personal/Account settings validation
export const personalSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  language: z.string().min(1, 'Language is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  dualTime: z.boolean().optional()
})

// Workspace settings validation
export const workspaceSettingsSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').min(2, 'Workspace name must be at least 2 characters'),
  domain: z.string().optional().refine(
    (val) => !val || /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(val),
    'Invalid domain format'
  ),
  timezone: z.string().min(1, 'Timezone is required')
})

// Security settings validation
export const securitySettingsSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

// Notification settings validation
export const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  desktopNotifications: z.boolean(),
  dailyDigest: z.boolean(),
  weeklyReport: z.boolean()
})

// Member invitation validation
export const memberInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['viewer', 'editor', 'admin'], {
    errorMap: () => ({ message: 'Please select a valid role' })
  })
})

// API key creation validation
export const apiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').min(2, 'Name must be at least 2 characters'),
  permissions: z.array(z.string()).min(1, 'Select at least one permission')
})

// Telephony settings validation
export const telephonySettingsSchema = z.object({
  defaultCountry: z.string().min(1, 'Default country is required'),
  callerId: z.string().optional(),
  quietHours: z.boolean().default(true)
})

// Note: TypeScript types are not exported in JavaScript files
// Use JSDoc comments for type information if needed
