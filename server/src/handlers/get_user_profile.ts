import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';
import { eq } from 'drizzle-orm';

export const getUserProfile = async (userId: number): Promise<User | null> => {
  try {
    // Query user by ID
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    // Return null if user not found
    if (results.length === 0) {
      return null;
    }

    // Return the user profile
    const user = results[0];
    return {
      ...user,
      // All fields are already properly typed from the database schema
      // No numeric conversions needed as all user fields are non-numeric
    };
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    throw error;
  }
};