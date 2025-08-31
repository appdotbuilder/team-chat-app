import { db } from '../db';
import { messagesTable, channelsTable, channelMembershipsTable, usersTable } from '../db/schema';
import { type CreateMessageInput, type Message } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createMessage = async (input: CreateMessageInput, senderId: number): Promise<Message> => {
  try {
    // Validate that sender exists
    const sender = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, senderId))
      .execute();

    if (sender.length === 0) {
      throw new Error('Sender user not found');
    }

    // Validate message destination - must be either channel or direct message
    if (!input.channel_id && !input.direct_message_recipient_id) {
      throw new Error('Message must specify either channel_id or direct_message_recipient_id');
    }

    if (input.channel_id && input.direct_message_recipient_id) {
      throw new Error('Message cannot specify both channel_id and direct_message_recipient_id');
    }

    // Validate channel message permissions
    if (input.channel_id) {
      // Check if channel exists
      const channel = await db.select()
        .from(channelsTable)
        .where(eq(channelsTable.id, input.channel_id))
        .execute();

      if (channel.length === 0) {
        throw new Error('Channel not found');
      }

      // Check if user is a member of the channel
      const membership = await db.select()
        .from(channelMembershipsTable)
        .where(and(
          eq(channelMembershipsTable.channel_id, input.channel_id),
          eq(channelMembershipsTable.user_id, senderId)
        ))
        .execute();

      if (membership.length === 0) {
        throw new Error('User is not a member of this channel');
      }
    }

    // Validate direct message recipient
    if (input.direct_message_recipient_id) {
      // Check if recipient exists
      const recipient = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.direct_message_recipient_id))
        .execute();

      if (recipient.length === 0) {
        throw new Error('Direct message recipient not found');
      }

      // Prevent sending message to self
      if (input.direct_message_recipient_id === senderId) {
        throw new Error('Cannot send direct message to yourself');
      }
    }

    // Validate reply_to_message_id if provided
    if (input.reply_to_message_id) {
      const originalMessage = await db.select()
        .from(messagesTable)
        .where(eq(messagesTable.id, input.reply_to_message_id))
        .execute();

      if (originalMessage.length === 0) {
        throw new Error('Original message not found for reply');
      }

      const original = originalMessage[0];

      // Ensure reply is in the same channel or direct message conversation
      if (input.channel_id && original.channel_id !== input.channel_id) {
        throw new Error('Reply must be in the same channel as original message');
      }

      if (input.direct_message_recipient_id) {
        // For direct messages, ensure the reply is between the same two users
        const isValidDMReply = (
          (original.sender_id === senderId && original.direct_message_recipient_id === input.direct_message_recipient_id) ||
          (original.sender_id === input.direct_message_recipient_id && original.direct_message_recipient_id === senderId)
        );

        if (!isValidDMReply) {
          throw new Error('Reply must be in the same direct message conversation as original message');
        }
      }
    }

    // Insert the message
    const result = await db.insert(messagesTable)
      .values({
        content: input.content,
        message_type: input.message_type,
        sender_id: senderId,
        channel_id: input.channel_id || null,
        direct_message_recipient_id: input.direct_message_recipient_id || null,
        reply_to_message_id: input.reply_to_message_id || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Message creation failed:', error);
    throw error;
  }
};