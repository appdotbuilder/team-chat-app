import { db } from '../db';
import { channelsTable, channelMembershipsTable } from '../db/schema';
import { type GetChannelsInput, type Channel } from '../schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export const getChannels = async (input: GetChannelsInput): Promise<Channel[]> => {
  try {
    if (input.user_id !== undefined && input.include_private) {
      // Get all public channels
      const publicChannels = await db.select()
        .from(channelsTable)
        .where(eq(channelsTable.is_private, false))
        .execute();

      // Get private channels where user is a member
      const userMemberships = await db.select({ channel_id: channelMembershipsTable.channel_id })
        .from(channelMembershipsTable)
        .where(eq(channelMembershipsTable.user_id, input.user_id))
        .execute();

      const memberChannelIds = userMemberships.map(m => m.channel_id);

      let privateChannels: any[] = [];
      if (memberChannelIds.length > 0) {
        privateChannels = await db.select()
          .from(channelsTable)
          .where(
            and(
              eq(channelsTable.is_private, true),
              inArray(channelsTable.id, memberChannelIds)
            )
          )
          .execute();
      }

      // Combine and return all channels
      return [...publicChannels, ...privateChannels];
    } else {
      // Only return public channels
      const channels = await db.select()
        .from(channelsTable)
        .where(eq(channelsTable.is_private, false))
        .execute();

      return channels;
    }
  } catch (error) {
    console.error('Get channels failed:', error);
    throw error;
  }
};