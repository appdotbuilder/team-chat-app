import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerUserInputSchema,
  loginUserInputSchema,
  updateUserProfileInputSchema,
  createChannelInputSchema,
  updateChannelInputSchema,
  channelMembershipInputSchema,
  createMessageInputSchema,
  updateMessageInputSchema,
  getMessagesInputSchema,
  createFileAttachmentInputSchema,
  createDirectMessageConversationInputSchema,
  getChannelsInputSchema
} from './schema';

// Import handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { updateUserProfile } from './handlers/update_user_profile';
import { getUserProfile } from './handlers/get_user_profile';
import { createChannel } from './handlers/create_channel';
import { getChannels } from './handlers/get_channels';
import { updateChannel } from './handlers/update_channel';
import { joinChannel } from './handlers/join_channel';
import { leaveChannel } from './handlers/leave_channel';
import { getChannelMembers } from './handlers/get_channel_members';
import { createMessage } from './handlers/create_message';
import { getMessages } from './handlers/get_messages';
import { updateMessage } from './handlers/update_message';
import { deleteMessage } from './handlers/delete_message';
import { createFileAttachment } from './handlers/create_file_attachment';
import { getFileAttachments } from './handlers/get_file_attachments';
import { createDirectMessageConversation } from './handlers/create_direct_message_conversation';
import { getDirectMessageConversations } from './handlers/get_direct_message_conversations';
import { searchMessages } from './handlers/search_messages';
import { getOnlineUsers } from './handlers/get_online_users';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User authentication and profile management
  registerUser: publicProcedure
    .input(registerUserInputSchema)
    .mutation(({ input }) => registerUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),

  getUserProfile: publicProcedure
    .input(z.number())
    .query(({ input }) => getUserProfile(input)),

  updateUserProfile: publicProcedure
    .input(updateUserProfileInputSchema)
    .mutation(({ input }) => updateUserProfile(input)),

  getOnlineUsers: publicProcedure
    .query(() => getOnlineUsers()),

  // Channel management
  createChannel: publicProcedure
    .input(createChannelInputSchema.extend({ creatorId: z.number() }))
    .mutation(({ input }) => createChannel(input, input.creatorId)),

  getChannels: publicProcedure
    .input(getChannelsInputSchema)
    .query(({ input }) => getChannels(input)),

  updateChannel: publicProcedure
    .input(updateChannelInputSchema)
    .mutation(({ input }) => updateChannel(input)),

  joinChannel: publicProcedure
    .input(channelMembershipInputSchema)
    .mutation(({ input }) => joinChannel(input)),

  leaveChannel: publicProcedure
    .input(channelMembershipInputSchema)
    .mutation(({ input }) => leaveChannel(input)),

  getChannelMembers: publicProcedure
    .input(z.number())
    .query(({ input }) => getChannelMembers(input)),

  // Message management
  createMessage: publicProcedure
    .input(createMessageInputSchema.extend({ senderId: z.number() }))
    .mutation(({ input }) => createMessage(input, input.senderId)),

  getMessages: publicProcedure
    .input(getMessagesInputSchema)
    .query(({ input }) => getMessages(input)),

  updateMessage: publicProcedure
    .input(updateMessageInputSchema)
    .mutation(({ input }) => updateMessage(input)),

  deleteMessage: publicProcedure
    .input(z.object({ messageId: z.number(), userId: z.number() }))
    .mutation(({ input }) => deleteMessage(input.messageId, input.userId)),

  searchMessages: publicProcedure
    .input(z.object({ 
      query: z.string(), 
      userId: z.number(), 
      channelId: z.number().optional() 
    }))
    .query(({ input }) => searchMessages(input.query, input.userId, input.channelId)),

  // File attachments
  createFileAttachment: publicProcedure
    .input(createFileAttachmentInputSchema)
    .mutation(({ input }) => createFileAttachment(input)),

  getFileAttachments: publicProcedure
    .input(z.number())
    .query(({ input }) => getFileAttachments(input)),

  // Direct message conversations
  createDirectMessageConversation: publicProcedure
    .input(createDirectMessageConversationInputSchema)
    .mutation(({ input }) => createDirectMessageConversation(input)),

  getDirectMessageConversations: publicProcedure
    .input(z.number())
    .query(({ input }) => getDirectMessageConversations(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC Team Communication Platform server listening at port: ${port}`);
}

start();