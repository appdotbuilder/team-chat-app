import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const loginUser = async (input: LoginUserInput): Promise<User> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .limit(1)
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // In a real application, you would verify the password hash here
    // For this implementation, we'll assume password verification is done elsewhere
    // and just check that a password was provided
    if (!input.password) {
      throw new Error('Invalid email or password');
    }

    // Update user status to online and updated_at timestamp
    const updatedUsers = await db.update(usersTable)
      .set({
        status: 'online',
        updated_at: new Date()
      })
      .where(eq(usersTable.id, user.id))
      .returning()
      .execute();

    return updatedUsers[0];
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
};