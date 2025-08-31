import { db } from '../db';
import { channelsTable, channelMembershipsTable, usersTable } from '../db/schema';
import { type CreateChannelInput, type Channel } from '../schema';
import { eq } from 'drizzle-orm';

export const createChannel = async (input: CreateChannelInput, creatorId: number): Promise<Channel> => {
  try {
    // First verify that the creator user exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, creatorId))
      .execute();

    if (existingUser.length === 0) {
      throw new Error(`User with id ${creatorId} does not exist`);
    }

    // Create the channel
    const channelResult = await db.insert(channelsTable)
      .values({
        name: input.name,
        description: input.description || null,
        is_private: input.is_private,
        created_by: creatorId
      })
      .returning()
      .execute();

    const channel = channelResult[0];

    // Automatically add the creator as owner of the channel
    await db.insert(channelMembershipsTable)
      .values({
        channel_id: channel.id,
        user_id: creatorId,
        role: 'owner'
      })
      .execute();

    return channel;
  } catch (error) {
    console.error('Channel creation failed:', error);
    throw error;
  }
};