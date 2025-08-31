import { db } from '../db';
import { directMessageConversationsTable } from '../db/schema';
import { type DirectMessageConversation } from '../schema';
import { or, eq } from 'drizzle-orm';

export const getDirectMessageConversations = async (userId: number): Promise<DirectMessageConversation[]> => {
  try {
    // Query conversations where the user is either user1 or user2
    const results = await db.select()
      .from(directMessageConversationsTable)
      .where(
        or(
          eq(directMessageConversationsTable.user1_id, userId),
          eq(directMessageConversationsTable.user2_id, userId)
        )
      )
      .execute();

    return results;
  } catch (error) {
    console.error('Get direct message conversations failed:', error);
    throw error;
  }
};