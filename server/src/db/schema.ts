import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userStatusEnum = pgEnum('user_status', ['online', 'away', 'busy', 'offline']);
export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'file', 'system']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  display_name: text('display_name'), // Nullable
  avatar_url: text('avatar_url'), // Nullable
  status: userStatusEnum('status').notNull().default('offline'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Channels table
export const channelsTable = pgTable('channels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  is_private: boolean('is_private').notNull().default(false),
  created_by: integer('created_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Channel memberships table
export const channelMembershipsTable = pgTable('channel_memberships', {
  id: serial('id').primaryKey(),
  channel_id: integer('channel_id').notNull().references(() => channelsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull().default('member'),
  joined_at: timestamp('joined_at').defaultNow().notNull()
});

// Direct message conversations table
export const directMessageConversationsTable = pgTable('direct_message_conversations', {
  id: serial('id').primaryKey(),
  user1_id: integer('user1_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  user2_id: integer('user2_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Messages table - declared with explicit type to avoid circular reference issues
export const messagesTable = pgTable('messages', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  message_type: messageTypeEnum('message_type').notNull().default('text'),
  sender_id: integer('sender_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  channel_id: integer('channel_id').references(() => channelsTable.id, { onDelete: 'cascade' }), // Nullable for DMs
  direct_message_recipient_id: integer('direct_message_recipient_id').references(() => usersTable.id, { onDelete: 'cascade' }), // Nullable for channel messages
  reply_to_message_id: integer('reply_to_message_id'), // Self-reference handled in relations
  edited_at: timestamp('edited_at'), // Nullable
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// File attachments table
export const fileAttachmentsTable = pgTable('file_attachments', {
  id: serial('id').primaryKey(),
  message_id: integer('message_id').notNull().references(() => messagesTable.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  original_filename: text('original_filename').notNull(),
  file_size: integer('file_size').notNull(),
  mime_type: text('mime_type').notNull(),
  file_url: text('file_url').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations - defined after all tables to avoid circular dependencies
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdChannels: many(channelsTable),
  channelMemberships: many(channelMembershipsTable),
  sentMessages: many(messagesTable, { relationName: 'sender' }),
  receivedDirectMessages: many(messagesTable, { relationName: 'dmRecipient' }),
  dmConversations1: many(directMessageConversationsTable, { relationName: 'user1' }),
  dmConversations2: many(directMessageConversationsTable, { relationName: 'user2' })
}));

export const channelsRelations = relations(channelsTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [channelsTable.created_by],
    references: [usersTable.id]
  }),
  memberships: many(channelMembershipsTable),
  messages: many(messagesTable)
}));

export const channelMembershipsRelations = relations(channelMembershipsTable, ({ one }) => ({
  channel: one(channelsTable, {
    fields: [channelMembershipsTable.channel_id],
    references: [channelsTable.id]
  }),
  user: one(usersTable, {
    fields: [channelMembershipsTable.user_id],
    references: [usersTable.id]
  })
}));

export const directMessageConversationsRelations = relations(directMessageConversationsTable, ({ one }) => ({
  user1: one(usersTable, {
    fields: [directMessageConversationsTable.user1_id],
    references: [usersTable.id],
    relationName: 'user1'
  }),
  user2: one(usersTable, {
    fields: [directMessageConversationsTable.user2_id],
    references: [usersTable.id],
    relationName: 'user2'
  })
}));

export const messagesRelations = relations(messagesTable, ({ one, many }) => ({
  sender: one(usersTable, {
    fields: [messagesTable.sender_id],
    references: [usersTable.id],
    relationName: 'sender'
  }),
  channel: one(channelsTable, {
    fields: [messagesTable.channel_id],
    references: [channelsTable.id]
  }),
  directMessageRecipient: one(usersTable, {
    fields: [messagesTable.direct_message_recipient_id],
    references: [usersTable.id],
    relationName: 'dmRecipient'
  }),
  replyToMessage: one(messagesTable, {
    fields: [messagesTable.reply_to_message_id],
    references: [messagesTable.id],
    relationName: 'replyTo'
  }),
  replies: many(messagesTable, { relationName: 'replyTo' }),
  fileAttachments: many(fileAttachmentsTable)
}));

export const fileAttachmentsRelations = relations(fileAttachmentsTable, ({ one }) => ({
  message: one(messagesTable, {
    fields: [fileAttachmentsTable.message_id],
    references: [messagesTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Channel = typeof channelsTable.$inferSelect;
export type NewChannel = typeof channelsTable.$inferInsert;

export type ChannelMembership = typeof channelMembershipsTable.$inferSelect;
export type NewChannelMembership = typeof channelMembershipsTable.$inferInsert;

export type DirectMessageConversation = typeof directMessageConversationsTable.$inferSelect;
export type NewDirectMessageConversation = typeof directMessageConversationsTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type FileAttachment = typeof fileAttachmentsTable.$inferSelect;
export type NewFileAttachment = typeof fileAttachmentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  channels: channelsTable,
  channelMemberships: channelMembershipsTable,
  directMessageConversations: directMessageConversationsTable,
  messages: messagesTable,
  fileAttachments: fileAttachmentsTable
};