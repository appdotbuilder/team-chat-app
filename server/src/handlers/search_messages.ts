import { db } from '../db';
import { messagesTable, channelMembershipsTable } from '../db/schema';
import { type Message } from '../schema';
import { eq, and, or, ilike, isNull, inArray } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

export const searchMessages = async (searchQuery: string, userId: number, channelId?: number): Promise<Message[]> => {
  try {
    // Return empty if query is empty or only whitespace
    if (!searchQuery.trim()) {
      return [];
    }

    // If channelId is provided, search only in that specific channel
    if (channelId !== undefined) {
      // Verify user has access to this channel by checking membership
      const membership = await db.select()
        .from(channelMembershipsTable)
        .where(and(
          eq(channelMembershipsTable.channel_id, channelId),
          eq(channelMembershipsTable.user_id, userId)
        ))
        .limit(1)
        .execute();

      if (membership.length === 0) {
        // User doesn't have access to this channel
        return [];
      }

      // Search in the specific channel
      const results = await db.select()
        .from(messagesTable)
        .where(and(
          ilike(messagesTable.content, `%${searchQuery.trim()}%`),
          eq(messagesTable.channel_id, channelId)
        ))
        .orderBy(messagesTable.created_at)
        .limit(50)
        .execute();

      return results;
    }

    // Search across all accessible messages (channels + DMs)
    
    // Get all channels the user is a member of
    const userChannels = await db.select({ channel_id: channelMembershipsTable.channel_id })
      .from(channelMembershipsTable)
      .where(eq(channelMembershipsTable.user_id, userId))
      .execute();

    const channelIds = userChannels.map(m => m.channel_id);

    // Search channel messages and direct messages separately, then combine
    const channelMessages = channelIds.length > 0 ? await db.select()
      .from(messagesTable)
      .where(and(
        ilike(messagesTable.content, `%${searchQuery.trim()}%`),
        inArray(messagesTable.channel_id, channelIds)
      ))
      .orderBy(messagesTable.created_at)
      .limit(25)
      .execute() : [];

    const directMessages = await db.select()
      .from(messagesTable)
      .where(and(
        ilike(messagesTable.content, `%${searchQuery.trim()}%`),
        isNull(messagesTable.channel_id),
        or(
          eq(messagesTable.sender_id, userId),
          eq(messagesTable.direct_message_recipient_id, userId)
        )
      ))
      .orderBy(messagesTable.created_at)
      .limit(25)
      .execute();

    // Combine and sort results
    const allResults = [...channelMessages, ...directMessages]
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(0, 50);

    return allResults;
  } catch (error) {
    console.error('Message search failed:', error);
    throw error;
  }
};