import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";
import axios, { AxiosInstance } from "axios";

// Define helper interfaces for Discord responses
export interface DiscordChannel {
  id: string;
  name?: string; // Optional field
  icon?: string;
  topic?: string;
  type?: number;
  guild_id?: string; // The ID of the guild (server) that the channel belongs to
}

interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
  };
  timestamp: string;
}

class DiscordContextProvider extends BaseContextProvider {
  // Description for the context provider
  static description: ContextProviderDescription = {
    title: "discord",
    displayTitle: "Discord",
    description: "Reference Discord messages from a channel",
    type: "submenu",
  };

  private baseUrl = "https://discord.com/api/v10";

  // Helper function to get the Axios instance with proper authorization
  private getApi(): AxiosInstance {
    const token = this.options.discordKey;
    if (!token) {
      throw new Error("Discord Bot Token is required!");
    }

    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  // Fetch Discord messages from a specific channel using Axios
  async fetchMessages(channelId: string): Promise<Array<DiscordMessage>> {
    const api = this.getApi();

    try {
      const response = await api.get<Array<DiscordMessage>>(
        `/channels/${channelId}/messages`,
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw new Error(`Failed to fetch messages: ${error}`);
    }
  }

  // Fetch Discord channels using Axios
  async fetchChannels(): Promise<Array<DiscordChannel>> {
    // If channels (with id and optional name) are already provided, skip the API call
    if (this.options.channels && this.options.channels.length > 0) {
      // Return the channel details using the provided channel objects
      return this.options.channels.map(
        (channel: { id: string; name?: string }) => ({
          id: channel.id,
          name: channel.name ?? `Channel ${channel.id}`, // Fall back to "Channel {id}" if name is not provided
        }),
      );
    }

    // If no channels are provided, fetch them from the API using guildId
    const api = this.getApi();

    try {
      const response = await api.get<Array<DiscordChannel>>(
        `/guilds/${this.options.guildId}/channels`,
      );

      // Filter for text channels (type 0 represents text channels)
      const filteredChannels = response.data.filter(
        (channel) => channel.type === 0,
      );

      return filteredChannels;
    } catch (error) {
      console.error("Error fetching channels:", error);
      throw new Error(`Failed to fetch channels: ${error}`);
    }
  }

  // Main function to get context items (messages)
  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    // Ensure channels are fetched if only guildId is provided
    const channels = await this.fetchChannels();

    // Determine the channel ID from the selected channel (either from query or the first in the options)
    let channelId: string;
    const selectedChannel = channels.find(
      (channel) => channel.id === query || channel.name === query,
    );

    channelId = selectedChannel ? selectedChannel.id : channels[0].id; // Use the first channel if no match is found

    // Prepare parts for rendering the message content
    const parts = ["# Discord Channel Messages", `Channel ID: ${channelId}`];
    const messages = await this.fetchMessages(channelId);

    // Check if there are messages
    if (messages.length > 0) {
      parts.push("## Messages");

      messages.forEach((message) => {
        // Log each message and the username to confirm access
        parts.push(
          `### ${message.author?.username ?? "Unknown User"} on ${
            message.timestamp
          }\n\n${message.content}`,
        );
      });
    } else {
      parts.push("No messages found.");
    }

    const content = parts.join("\n\n");

    return [
      {
        name: `Messages from Channel ${channelId}`,
        content,
        description: "Latest messages from the channel",
      },
    ];
  }

  // Submenu to load the list of channels
  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const channels = await this.fetchChannels();

    // Map over the channels and return them as submenu items
    return channels.map((channel) => ({
      id: channel.id,
      title: channel.name || `Channel ${channel.id}`, // Fallback to ID if name is missing
      description: channel.topic ?? "",
    }));
  }
}

export default DiscordContextProvider;
