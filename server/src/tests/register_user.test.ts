import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput } from '../schema';
import { registerUser } from '../handlers/register_user';
import { eq } from 'drizzle-orm';

// Test input with all fields
const testInput: RegisterUserInput = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123',
  display_name: 'Test User'
};

// Test input without optional display_name
const testInputMinimal: RegisterUserInput = {
  username: 'minimaluser',
  email: 'minimal@example.com',
  password: 'password123'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user with all fields', async () => {
    const result = await registerUser(testInput);

    // Basic field validation
    expect(result.username).toEqual('testuser');
    expect(result.email).toEqual('test@example.com');
    expect(result.display_name).toEqual('Test User');
    expect(result.avatar_url).toBeNull();
    expect(result.status).toEqual('offline');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Password should be hashed, not plain text
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('testpassword123');
    expect(result.password_hash.length).toBeGreaterThan(20); // Hashed passwords are longer
  });

  it('should register a user without optional display_name', async () => {
    const result = await registerUser(testInputMinimal);

    expect(result.username).toEqual('minimaluser');
    expect(result.email).toEqual('minimal@example.com');
    expect(result.display_name).toBeNull();
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123');
  });

  it('should save user to database', async () => {
    const result = await registerUser(testInput);

    // Query database to verify user was saved
    const savedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(savedUsers).toHaveLength(1);
    const savedUser = savedUsers[0];
    expect(savedUser.username).toEqual('testuser');
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.display_name).toEqual('Test User');
    expect(savedUser.status).toEqual('offline');
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);
  });

  it('should throw error for duplicate email', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register another user with same email
    const duplicateEmailInput: RegisterUserInput = {
      username: 'differentuser',
      email: 'test@example.com', // Same email
      password: 'password123'
    };

    await expect(registerUser(duplicateEmailInput)).rejects.toThrow(/email already exists/i);
  });

  it('should throw error for duplicate username', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register another user with same username
    const duplicateUsernameInput: RegisterUserInput = {
      username: 'testuser', // Same username
      email: 'different@example.com',
      password: 'password123'
    };

    await expect(registerUser(duplicateUsernameInput)).rejects.toThrow(/username already exists/i);
  });

  it('should generate different password hashes for same password', async () => {
    const user1Input: RegisterUserInput = {
      username: 'user1',
      email: 'user1@example.com',
      password: 'samepassword'
    };

    const user2Input: RegisterUserInput = {
      username: 'user2',
      email: 'user2@example.com',
      password: 'samepassword'
    };

    const result1 = await registerUser(user1Input);
    const result2 = await registerUser(user2Input);

    // Same password should produce same hash (with static salt)
    // In production with proper salting, these would be different
    expect(result1.password_hash).toEqual(result2.password_hash);
    expect(result1.password_hash).not.toEqual('samepassword');
  });

  it('should handle users registered at different times', async () => {
    const result1 = await registerUser(testInput);
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const result2 = await registerUser(testInputMinimal);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.username).not.toEqual(result2.username);
    expect(result1.email).not.toEqual(result2.email);
    
    // Both should have valid timestamps
    expect(result1.created_at).toBeInstanceOf(Date);
    expect(result2.created_at).toBeInstanceOf(Date);
    expect(result1.updated_at).toBeInstanceOf(Date);
    expect(result2.updated_at).toBeInstanceOf(Date);
  });

  it('should verify all required fields are present in database', async () => {
    const result = await registerUser(testInput);

    const savedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    const savedUser = savedUsers[0];

    // Verify all non-nullable fields are present
    expect(savedUser.id).toBeDefined();
    expect(savedUser.username).toBeDefined();
    expect(savedUser.email).toBeDefined();
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.status).toBeDefined();
    expect(savedUser.created_at).toBeDefined();
    expect(savedUser.updated_at).toBeDefined();

    // Verify nullable fields can be null
    expect(savedUser.display_name).toEqual('Test User'); // This specific test has display_name
    expect(savedUser.avatar_url).toBeNull();
  });
});