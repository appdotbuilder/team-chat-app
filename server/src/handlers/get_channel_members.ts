import { db } from '../db';
import { channelMembershipsTable, channelsTable } from '../db/schema';
import { type ChannelMembership } from '../schema';
import { eq } from 'drizzle-orm';

export const getChannelMembers = async (channelId: number): Promise<ChannelMembership[]> => {
  try {
    // First verify the channel exists
    const channel = await db.select()
      .from(channelsTable)
      .where(eq(channelsTable.id, channelId))
      .execute();

    if (channel.length === 0) {
      throw new Error(`Channel with id ${channelId} not found`);
    }

    // Fetch all members of the specified channel
    const members = await db.select()
      .from(channelMembershipsTable)
      .where(eq(channelMembershipsTable.channel_id, channelId))
      .execute();

    return members;
  } catch (error) {
    console.error('Get channel members failed:', error);
    throw error;
  }
};