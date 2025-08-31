import { db } from '../db';
import { directMessageConversationsTable, usersTable } from '../db/schema';
import { type CreateDirectMessageConversationInput, type DirectMessageConversation } from '../schema';
import { eq, or, and } from 'drizzle-orm';

export const createDirectMessageConversation = async (input: CreateDirectMessageConversationInput): Promise<DirectMessageConversation> => {
  try {
    // Validate that both users exist
    const users = await db.select()
      .from(usersTable)
      .where(or(
        eq(usersTable.id, input.user1_id),
        eq(usersTable.id, input.user2_id)
      ))
      .execute();

    // Check if users exist - handle case where user1_id === user2_id (self-conversation)
    const expectedUserCount = input.user1_id === input.user2_id ? 1 : 2;
    if (users.length !== expectedUserCount) {
      throw new Error('One or both users do not exist');
    }

    // Check if conversation already exists (in either direction)
    const existingConversation = await db.select()
      .from(directMessageConversationsTable)
      .where(
        or(
          and(
            eq(directMessageConversationsTable.user1_id, input.user1_id),
            eq(directMessageConversationsTable.user2_id, input.user2_id)
          ),
          and(
            eq(directMessageConversationsTable.user1_id, input.user2_id),
            eq(directMessageConversationsTable.user2_id, input.user1_id)
          )
        )
      )
      .execute();

    // Return existing conversation if found
    if (existingConversation.length > 0) {
      return existingConversation[0];
    }

    // Create new conversation
    const result = await db.insert(directMessageConversationsTable)
      .values({
        user1_id: input.user1_id,
        user2_id: input.user2_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Direct message conversation creation failed:', error);
    throw error;
  }
};