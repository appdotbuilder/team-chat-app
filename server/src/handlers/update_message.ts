import { db } from '../db';
import { messagesTable } from '../db/schema';
import { type UpdateMessageInput, type Message } from '../schema';
import { eq } from 'drizzle-orm';

export const updateMessage = async (input: UpdateMessageInput): Promise<Message> => {
  try {
    // Update the message with the new content and set edited_at timestamp
    const result = await db.update(messagesTable)
      .set({
        content: input.content,
        edited_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(messagesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Message with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Message update failed:', error);
    throw error;
  }
};