import { db } from '../db';
import { channelsTable } from '../db/schema';
import { type UpdateChannelInput, type Channel } from '../schema';
import { eq } from 'drizzle-orm';

export const updateChannel = async (input: UpdateChannelInput): Promise<Channel> => {
  try {
    // Build update object with only provided fields
    const updateData: any = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    
    if (input.is_private !== undefined) {
      updateData.is_private = input.is_private;
    }
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    // Update the channel and return the updated record
    const result = await db
      .update(channelsTable)
      .set(updateData)
      .where(eq(channelsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Channel with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Channel update failed:', error);
    throw error;
  }
};