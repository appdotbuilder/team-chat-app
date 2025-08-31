import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashed_password_123',
  display_name: 'Test User',
  status: 'offline' as const
};

const validLoginInput: LoginUserInput = {
  email: 'test@example.com',
  password: 'password123'
};

const invalidEmailInput: LoginUserInput = {
  email: 'nonexistent@example.com',
  password: 'password123'
};

const emptyPasswordInput: LoginUserInput = {
  email: 'test@example.com',
  password: ''
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should login user successfully and set status to online', async () => {
    // Create test user first
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    const result = await loginUser(validLoginInput);

    // Verify user data is returned correctly
    expect(result.email).toEqual('test@example.com');
    expect(result.username).toEqual('testuser');
    expect(result.display_name).toEqual('Test User');
    expect(result.password_hash).toEqual('hashed_password_123');
    expect(result.status).toEqual('online'); // Should be updated to online
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update user status to online in database', async () => {
    // Create test user with offline status
    const insertedUsers = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const userId = insertedUsers[0].id;

    // Login user
    await loginUser(validLoginInput);

    // Verify status was updated in database
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    expect(updatedUsers).toHaveLength(1);
    expect(updatedUsers[0].status).toEqual('online');
    expect(updatedUsers[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update updated_at timestamp', async () => {
    // Create test user
    const originalTime = new Date('2023-01-01T00:00:00Z');
    await db.insert(usersTable)
      .values({
        ...testUser,
        created_at: originalTime,
        updated_at: originalTime
      })
      .execute();

    // Login user
    const result = await loginUser(validLoginInput);

    // Verify updated_at was changed
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTime.getTime());
  });

  it('should throw error for non-existent email', async () => {
    // Don't create any users

    await expect(loginUser(invalidEmailInput))
      .rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for empty password', async () => {
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();

    await expect(loginUser(emptyPasswordInput))
      .rejects.toThrow(/invalid email or password/i);
  });

  it('should handle user with null display_name', async () => {
    // Create user with null display_name
    await db.insert(usersTable)
      .values({
        ...testUser,
        display_name: null
      })
      .execute();

    const result = await loginUser(validLoginInput);

    expect(result.display_name).toBeNull();
    expect(result.email).toEqual('test@example.com');
    expect(result.status).toEqual('online');
  });

  it('should handle user with different initial status', async () => {
    // Create user with 'busy' status
    await db.insert(usersTable)
      .values({
        ...testUser,
        status: 'busy'
      })
      .execute();

    const result = await loginUser(validLoginInput);

    // Should change to online regardless of previous status
    expect(result.status).toEqual('online');
  });

  it('should work with case-sensitive email matching', async () => {
    // Create user with lowercase email
    await db.insert(usersTable)
      .values({
        ...testUser,
        email: 'test@example.com'
      })
      .execute();

    // Try to login with different case (this should fail as email matching is case-sensitive)
    const mixedCaseInput: LoginUserInput = {
      email: 'Test@Example.COM',
      password: 'password123'
    };

    await expect(loginUser(mixedCaseInput))
      .rejects.toThrow(/invalid email or password/i);
  });
});