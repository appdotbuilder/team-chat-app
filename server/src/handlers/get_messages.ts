import { db } from '../db';
import { messagesTable } from '../db/schema';
import { type GetMessagesInput, type Message } from '../schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { SQL } from 'drizzle-orm';

export const getMessages = async (input: GetMessagesInput): Promise<Message[]> => {
  try {
    // Set default pagination values
    const page = input.page || 1;
    const limit = input.limit || 50;
    const offset = (page - 1) * limit;

    // Validate input - cannot specify both channel and DM recipient
    if (input.channel_id !== undefined && input.direct_message_recipient_id !== undefined) {
      throw new Error('Cannot specify both channel_id and direct_message_recipient_id');
    }

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Filter by channel or direct message conversation
    if (input.channel_id !== undefined) {
      if (input.channel_id === null) {
        // Looking for direct messages (no channel)
        conditions.push(isNull(messagesTable.channel_id));
      } else {
        // Looking for messages in a specific channel
        conditions.push(eq(messagesTable.channel_id, input.channel_id));
      }
    }

    if (input.direct_message_recipient_id !== undefined) {
      if (input.direct_message_recipient_id === null) {
        // Looking for channel messages (no direct recipient)
        conditions.push(isNull(messagesTable.direct_message_recipient_id));
      } else {
        // Looking for direct messages with a specific recipient
        conditions.push(eq(messagesTable.direct_message_recipient_id, input.direct_message_recipient_id));
      }
    }

    // Build and execute query
    const baseQuery = db.select().from(messagesTable);
    
    const results = conditions.length === 0 
      ? await baseQuery
          .orderBy(desc(messagesTable.created_at))
          .limit(limit)
          .offset(offset)
          .execute()
      : await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(messagesTable.created_at))
          .limit(limit)
          .offset(offset)
          .execute();

    // Return messages (no numeric conversion needed for this schema)
    return results;
  } catch (error) {
    console.error('Get messages failed:', error);
    throw error;
  }
};