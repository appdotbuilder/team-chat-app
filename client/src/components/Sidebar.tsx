import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import { toast } from 'sonner';
import type { User, Channel, DirectMessageConversation, CreateChannelInput } from '../../../server/src/schema';

interface SidebarProps {
  user: User;
  channels: Channel[];
  dmConversations: DirectMessageConversation[];
  onlineUsers: User[];
  selectedChannel: Channel | null;
  selectedDMConversation: DirectMessageConversation | null;
  onChannelSelect: (channel: Channel) => void;
  onDMSelect: (conversation: DirectMessageConversation) => void;
  onChannelCreated: (channel: Channel) => void;
  onChannelJoined: (channel: Channel) => void;
  onChannelLeft: (channelId: number) => void;
  onDMConversationCreated: (conversation: DirectMessageConversation) => void;
  onShowProfile: () => void;
  onLogout: () => void;
}

export function Sidebar({
  user,
  channels,
  dmConversations,
  onlineUsers,
  selectedChannel,
  selectedDMConversation,
  onChannelSelect,
  onDMSelect,
  onChannelCreated,
  onChannelJoined,
  onChannelLeft,
  onDMConversationCreated,
  onShowProfile,
  onLogout
}: SidebarProps) {
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isJoinChannelOpen, setIsJoinChannelOpen] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  // Channel creation form
  const [channelForm, setChannelForm] = useState<CreateChannelInput>({
    name: '',
    description: null,
    is_private: false
  });

  // Join channel search
  const [channelSearch, setChannelSearch] = useState('');

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await trpc.createChannel.mutate({
        ...channelForm,
        creatorId: user.id
      });
      
      onChannelCreated(result);
      setIsCreateChannelOpen(false);
      setChannelForm({ name: '', description: null, is_private: false });
      toast.success(`Channel "${result.name}" created! 🎉`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create channel';
      toast.error(errorMessage);
    }
  };

  const handleJoinChannelOpen = async () => {
    setIsJoinChannelOpen(true);
    setIsLoadingChannels(true);
    
    try {
      const result = await trpc.getChannels.query({ include_private: false });
      // Filter out channels the user is already in
      const userChannelIds = channels.map(c => c.id);
      setAvailableChannels(result.filter(c => !userChannelIds.includes(c.id)));
    } catch (error: unknown) {
      console.error('Failed to load channels:', error);
      toast.error('Failed to load available channels');
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const handleJoinChannel = async (channel: Channel) => {
    try {
      await trpc.joinChannel.mutate({
        channel_id: channel.id,
        user_id: user.id,
        role: 'member'
      });
      
      onChannelJoined(channel);
      setIsJoinChannelOpen(false);
      toast.success(`Joined "${channel.name}"! 🎉`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to join channel';
      toast.error(errorMessage);
    }
  };

  const handleLeaveChannel = async (channel: Channel) => {
    try {
      await trpc.leaveChannel.mutate({
        channel_id: channel.id,
        user_id: user.id
      });
      
      onChannelLeft(channel.id);
      toast.success(`Left "${channel.name}"`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to leave channel';
      toast.error(errorMessage);
    }
  };

  const handleStartDM = async (targetUser: User) => {
    try {
      // Check if conversation already exists
      const existingConv = dmConversations.find(dm => 
        (dm.user1_id === user.id && dm.user2_id === targetUser.id) ||
        (dm.user1_id === targetUser.id && dm.user2_id === user.id)
      );

      if (existingConv) {
        onDMSelect(existingConv);
        return;
      }

      // Create new conversation
      const result = await trpc.createDirectMessageConversation.mutate({
        user1_id: user.id,
        user2_id: targetUser.id
      });
      
      onDMConversationCreated(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start conversation';
      toast.error(errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'away': return '🟡';
      case 'busy': return '🔴';
      default: return '⚫';
    }
  };

  // Filter available channels based on search
  const filteredChannels = availableChannels.filter(channel =>
    channel.name.toLowerCase().includes(channelSearch.toLowerCase())
  );

  // Get other user for DM conversations
  const getOtherUser = (conversation: DirectMessageConversation) => {
    const otherUserId = conversation.user1_id === user.id ? conversation.user2_id : conversation.user1_id;
    return onlineUsers.find(u => u.id === otherUserId);
  };

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">💬 TeamChat</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || ''} />
                  <AvatarFallback className="bg-blue-600 text-xs">
                    {(user.display_name || user.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || ''} />
                  <AvatarFallback className="bg-blue-600 text-xs">
                    {(user.display_name || user.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user.display_name || user.username}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{getStatusIcon(user.status)}</span>
                    <span className="text-xs text-muted-foreground capitalize">{user.status}</span>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onShowProfile}>
                👤 Edit Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-600">
                🚪 Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* Channels Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              📺 Channels
            </h2>
            <div className="flex gap-1">
              <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-400 hover:text-white">
                    ➕
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Channel</DialogTitle>
                    <DialogDescription>
                      Create a new channel for team discussions
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateChannel}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="channel-name">Channel Name</Label>
                        <Input
                          id="channel-name"
                          placeholder="e.g. general, random, project-alpha"
                          value={channelForm.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setChannelForm(prev => ({ ...prev, name: e.target.value }))
                          }
                          required
                          maxLength={50}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="channel-description">Description (Optional)</Label>
                        <Textarea
                          id="channel-description"
                          placeholder="What's this channel about?"
                          value={channelForm.description || ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setChannelForm(prev => ({ ...prev, description: e.target.value || null }))
                          }
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="channel-private"
                          checked={channelForm.is_private}
                          onCheckedChange={(checked: boolean) =>
                            setChannelForm(prev => ({ ...prev, is_private: checked }))
                          }
                        />
                        <Label htmlFor="channel-private">
                          Private Channel
                          <span className="text-sm text-gray-500 block">
                            Only invited members can join
                          </span>
                        </Label>
                      </div>
                    </div>
                    <DialogFooter className="mt-6">
                      <Button type="submit">Create Channel</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isJoinChannelOpen} onOpenChange={setIsJoinChannelOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                    onClick={handleJoinChannelOpen}
                  >
                    🔍
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Join Channel</DialogTitle>
                    <DialogDescription>
                      Browse and join available public channels
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Search channels..."
                      value={channelSearch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChannelSearch(e.target.value)}
                    />
                    <ScrollArea className="h-64">
                      {isLoadingChannels ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-sm text-gray-500">Loading channels...</div>
                        </div>
                      ) : filteredChannels.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-sm text-gray-500">No channels found</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredChannels.map((channel: Channel) => (
                            <div key={channel.id} className="flex items-center justify-between p-2 border rounded">
                              <div>
                                <div className="font-medium">#{channel.name}</div>
                                {channel.description && (
                                  <div className="text-sm text-gray-500">{channel.description}</div>
                                )}
                              </div>
                              <Button size="sm" onClick={() => handleJoinChannel(channel)}>
                                Join
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="space-y-1">
            {channels.map((channel: Channel) => (
              <div key={channel.id} className="group">
                <Button
                  variant={selectedChannel?.id === channel.id ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => onChannelSelect(channel)}
                >
                  <span className="mr-2">{channel.is_private ? '🔒' : '#'}</span>
                  <span className="truncate flex-1">{channel.name}</span>
                </Button>
                {selectedChannel?.id === channel.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 ml-6 h-6 text-xs text-red-400 hover:text-red-300"
                    onClick={() => handleLeaveChannel(channel)}
                  >
                    Leave
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Direct Messages Section */}
        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            💬 Direct Messages
          </h2>
          
          <div className="space-y-1">
            {dmConversations.map((conversation: DirectMessageConversation) => {
              const otherUser = getOtherUser(conversation);
              if (!otherUser) return null;
              
              return (
                <Button
                  key={conversation.id}
                  variant={selectedDMConversation?.id === conversation.id ? "secondary" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => onDMSelect(conversation)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="relative">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={otherUser.avatar_url || ''} />
                        <AvatarFallback className="bg-gray-600 text-xs">
                          {(otherUser.display_name || otherUser.username).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(otherUser.status)}`} />
                    </div>
                    <span className="truncate">{otherUser.display_name || otherUser.username}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Online Users Section */}
        <div className="p-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
            👥 Team ({onlineUsers.length})
          </h2>
          
          <div className="space-y-1">
            {onlineUsers
              .filter((u: User) => u.id !== user.id)
              .map((u: User) => (
                <Button
                  key={u.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => handleStartDM(u)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="relative">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={u.avatar_url || ''} />
                        <AvatarFallback className="bg-gray-600 text-xs">
                          {(u.display_name || u.username).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(u.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{u.display_name || u.username}</div>
                      <div className="text-xs text-gray-400 capitalize">{u.status}</div>
                    </div>
                  </div>
                </Button>
              ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}