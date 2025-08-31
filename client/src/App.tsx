import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { AuthForm } from '@/components/AuthForm';
import { ChatInterface } from '@/components/ChatInterface';
import { Sidebar } from '@/components/Sidebar';
import { UserProfile } from '@/components/UserProfile';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import type { User, Channel, DirectMessageConversation } from '../../server/src/schema';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedDMConversation, setSelectedDMConversation] = useState<DirectMessageConversation | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmConversations, setDMConversations] = useState<DirectMessageConversation[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Load user data from localStorage on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user data:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Load channels and DM conversations when user logs in
  const loadUserData = useCallback(async (userId: number) => {
    try {
      const [channelsResult, dmResult, onlineUsersResult] = await Promise.all([
        trpc.getChannels.query({ user_id: userId }),
        trpc.getDirectMessageConversations.query(userId),
        trpc.getOnlineUsers.query()
      ]);
      
      setChannels(channelsResult);
      setDMConversations(dmResult);
      setOnlineUsers(onlineUsersResult);
    } catch (error) {
      console.error('Failed to load user data:', error);
      toast.error('Failed to load your data');
    }
  }, []);

  // Load data when user is set
  useEffect(() => {
    if (user?.id) {
      loadUserData(user.id);
    }
  }, [user, loadUserData]);

  // Periodic refresh of online users
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(async () => {
      try {
        const result = await trpc.getOnlineUsers.query();
        setOnlineUsers(result);
      } catch (error) {
        console.error('Failed to refresh online users:', error);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = async (email: string, password: string) => {
    try {
      const result = await trpc.loginUser.mutate({ email, password });
      setUser(result);
      localStorage.setItem('user', JSON.stringify(result));
      toast.success(`Welcome back, ${result.display_name || result.username}! 👋`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleRegister = async (username: string, email: string, password: string, displayName?: string) => {
    try {
      const result = await trpc.registerUser.mutate({ 
        username, 
        email, 
        password, 
        display_name: displayName || null 
      });
      setUser(result);
      localStorage.setItem('user', JSON.stringify(result));
      toast.success(`Welcome to the team, ${result.display_name || result.username}! 🎉`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      toast.error(errorMessage);
      throw error;
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedChannel(null);
    setSelectedDMConversation(null);
    setChannels([]);
    setDMConversations([]);
    setOnlineUsers([]);
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setSelectedDMConversation(null);
  };

  const handleDMSelect = (conversation: DirectMessageConversation) => {
    setSelectedDMConversation(conversation);
    setSelectedChannel(null);
  };

  const handleChannelCreated = (channel: Channel) => {
    setChannels(prev => [...prev, channel]);
    setSelectedChannel(channel);
  };

  const handleChannelJoined = (channel: Channel) => {
    setChannels(prev => {
      const exists = prev.find(c => c.id === channel.id);
      if (exists) return prev;
      return [...prev, channel];
    });
  };

  const handleChannelLeft = (channelId: number) => {
    setChannels(prev => prev.filter(c => c.id !== channelId));
    if (selectedChannel?.id === channelId) {
      setSelectedChannel(null);
    }
  };

  const handleDMConversationCreated = (conversation: DirectMessageConversation) => {
    setDMConversations(prev => {
      const exists = prev.find(dm => dm.id === conversation.id);
      if (exists) return prev;
      return [...prev, conversation];
    });
    setSelectedDMConversation(conversation);
  };

  // If user is not logged in, show auth form
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">💬 TeamChat</h1>
            <p className="text-gray-600">Connect, collaborate, and communicate with your team</p>
          </div>
          <AuthForm 
            onLogin={handleLogin}
            onRegister={handleRegister}
          />
        </div>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar
        user={user}
        channels={channels}
        dmConversations={dmConversations}
        onlineUsers={onlineUsers}
        selectedChannel={selectedChannel}
        selectedDMConversation={selectedDMConversation}
        onChannelSelect={handleChannelSelect}
        onDMSelect={handleDMSelect}
        onChannelCreated={handleChannelCreated}
        onChannelJoined={handleChannelJoined}
        onChannelLeft={handleChannelLeft}
        onDMConversationCreated={handleDMConversationCreated}
        onShowProfile={() => setShowUserProfile(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannel || selectedDMConversation ? (
          <ChatInterface
            user={user}
            selectedChannel={selectedChannel}
            selectedDMConversation={selectedDMConversation}
            onlineUsers={onlineUsers}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Welcome to TeamChat!</h2>
              <p className="text-gray-500 mb-6">Select a channel or start a direct message to begin chatting</p>
              <div className="space-y-2 text-sm text-gray-400">
                <p>• Join public channels to collaborate with your team</p>
                <p>• Create private channels for focused discussions</p>
                <p>• Send direct messages for one-on-one conversations</p>
                <p>• Share files, images, and rich content</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {showUserProfile && (
        <UserProfile
          user={user}
          onClose={() => setShowUserProfile(false)}
          onUserUpdated={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }}
        />
      )}

      <Toaster />
    </div>
  );
}

export default App;