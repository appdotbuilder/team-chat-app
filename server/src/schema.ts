import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  password_hash: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  status: z.enum(['online', 'away', 'busy', 'offline']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Input schema for user registration
export const registerUserInputSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().nullable().optional()
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// Input schema for user login
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Input schema for updating user profile
export const updateUserProfileInputSchema = z.object({
  id: z.number(),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  status: z.enum(['online', 'away', 'busy', 'offline']).optional()
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileInputSchema>;

// Channel schema
export const channelSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  is_private: z.boolean(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Channel = z.infer<typeof channelSchema>;

// Input schema for creating channels
export const createChannelInputSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().nullable().optional(),
  is_private: z.boolean()
});

export type CreateChannelInput = z.infer<typeof createChannelInputSchema>;

// Input schema for updating channels
export const updateChannelInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(50).optional(),
  description: z.string().nullable().optional(),
  is_private: z.boolean().optional()
});

export type UpdateChannelInput = z.infer<typeof updateChannelInputSchema>;

// Channel membership schema
export const channelMembershipSchema = z.object({
  id: z.number(),
  channel_id: z.number(),
  user_id: z.number(),
  role: z.enum(['owner', 'admin', 'member']),
  joined_at: z.coerce.date()
});

export type ChannelMembership = z.infer<typeof channelMembershipSchema>;

// Input schema for joining/leaving channels
export const channelMembershipInputSchema = z.object({
  channel_id: z.number(),
  user_id: z.number(),
  role: z.enum(['owner', 'admin', 'member']).optional()
});

export type ChannelMembershipInput = z.infer<typeof channelMembershipInputSchema>;

// Message schema
export const messageSchema = z.object({
  id: z.number(),
  content: z.string(),
  message_type: z.enum(['text', 'file', 'system']),
  sender_id: z.number(),
  channel_id: z.number().nullable(),
  direct_message_recipient_id: z.number().nullable(),
  reply_to_message_id: z.number().nullable(),
  edited_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Message = z.infer<typeof messageSchema>;

// Input schema for creating messages
export const createMessageInputSchema = z.object({
  content: z.string().min(1),
  message_type: z.enum(['text', 'file', 'system']),
  channel_id: z.number().nullable().optional(),
  direct_message_recipient_id: z.number().nullable().optional(),
  reply_to_message_id: z.number().nullable().optional()
});

export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;

// Input schema for updating messages
export const updateMessageInputSchema = z.object({
  id: z.number(),
  content: z.string().min(1)
});

export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>;

// File attachment schema
export const fileAttachmentSchema = z.object({
  id: z.number(),
  message_id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  file_url: z.string(),
  created_at: z.coerce.date()
});

export type FileAttachment = z.infer<typeof fileAttachmentSchema>;

// Input schema for file uploads
export const createFileAttachmentInputSchema = z.object({
  message_id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  file_url: z.string()
});

export type CreateFileAttachmentInput = z.infer<typeof createFileAttachmentInputSchema>;

// Direct message conversation schema
export const directMessageConversationSchema = z.object({
  id: z.number(),
  user1_id: z.number(),
  user2_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type DirectMessageConversation = z.infer<typeof directMessageConversationSchema>;

// Input schema for creating DM conversations
export const createDirectMessageConversationInputSchema = z.object({
  user1_id: z.number(),
  user2_id: z.number()
});

export type CreateDirectMessageConversationInput = z.infer<typeof createDirectMessageConversationInputSchema>;

// Generic pagination schema
export const paginationInputSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

// Get messages input schema
export const getMessagesInputSchema = z.object({
  channel_id: z.number().nullable().optional(),
  direct_message_recipient_id: z.number().nullable().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional()
});

export type GetMessagesInput = z.infer<typeof getMessagesInputSchema>;

// Get channels input schema
export const getChannelsInputSchema = z.object({
  user_id: z.number().optional(),
  include_private: z.boolean().optional()
});

export type GetChannelsInput = z.infer<typeof getChannelsInputSchema>;