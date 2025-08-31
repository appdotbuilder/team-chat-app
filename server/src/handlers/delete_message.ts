import { db } from '../db';
import { messagesTable, channelMembershipsTable, channelsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const deleteMessage = async (messageId: number, userId: number): Promise<boolean> => {
  try {
    // First, verify the message exists and get its details
    const messageResult = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .execute();

    if (messageResult.length === 0) {
      throw new Error('Message not found');
    }

    const message = messageResult[0];

    // Check if user is the original sender
    const isOriginalSender = message.sender_id === userId;

    // If not the original sender, check if user has admin/owner permissions in the channel
    let hasPermission = isOriginalSender;

    if (!hasPermission && message.channel_id) {
      // Check channel permissions for channel messages
      const membershipResult = await db.select()
        .from(channelMembershipsTable)
        .where(
          and(
            eq(channelMembershipsTable.channel_id, message.channel_id),
            eq(channelMembershipsTable.user_id, userId)
          )
        )
        .execute();

      if (membershipResult.length > 0) {
        const membership = membershipResult[0];
        hasPermission = membership.role === 'owner' || membership.role === 'admin';
      }
    } else if (!hasPermission && message.direct_message_recipient_id) {
      // For direct messages, only the sender can delete
      hasPermission = false;
    }

    if (!hasPermission) {
      throw new Error('Unauthorized to delete this message');
    }

    // Delete the message (file attachments will be cascade deleted automatically)
    const deleteResult = await db.delete(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .execute();

    return (deleteResult.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Message deletion failed:', error);
    throw error;
  }
};