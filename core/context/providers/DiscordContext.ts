import { AxiosError, AxiosInstance } from "axios";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

// Define helper interfaces for Discord responses
export interface DiscordChannel {
  id: string;
  name?: string;
  icon?: string;
  topic?: string;
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
    title: "discord-messages",
    displayTitle: "Discord Messages",
    description: "Reference messages from a Discord channel",
    type: "normal",
  };

  // Helper function to get the Axios instance with proper authorization
  private async getApi(): Promise<AxiosInstance> {
    const { default: Axios } = await import("axios");
    const token = this.options.token;
    if (!token) {
      throw new Error("Discord Bot Token is required!");
    }

    return Axios.create({
      baseURL: "https://discord.com/api/v10",
      headers: {
        Authorization: `Bot ${token}`,
      },
    });
  }

  // Reusable error handling method
  private handleApiError(ex: unknown): string {
    let content = "# Discord API Error\n\nFailed to retrieve data. ";
    if (ex instanceof AxiosError) {
      if (ex.response) {
        const errorMessage = ex.response?.data
          ? (ex.response.data.message ?? JSON.stringify(ex.response?.data))
          : `${ex.response.status}: ${ex.response.statusText}`;
        content += `Discord API Error: ${errorMessage}`;
      } else {
        content += `Discord API Request Error ${ex.request}`;
      }
    } else {
      content += `Unknown error: ${ex instanceof Error ? ex.message : JSON.stringify(ex)}`;
    }
    return content;
  }

  // Fetch Discord channels
  private async fetchChannels(
    extras: ContextProviderExtras,
  ): Promise<Array<DiscordChannel>> {
    const api = await this.getApi();

    try {
      const response = await api.get<Array<DiscordChannel>>(
        `/guilds/${this.options.guildId}/channels`,
      );
      return response.data;
    } catch (ex) {
      throw new Error(this.handleApiError(ex));
    }
  }

  // Fetch messages from a specific channel
  private async fetchMessages(
    channelId: string,
    extras: ContextProviderExtras,
  ): Promise<Array<DiscordMessage>> {
    const api = await this.getApi();
    try {
      const response = await api.get<Array<DiscordMessage>>(
        `/channels/${channelId}/messages`,
        { params: { limit: 10 } },
      );
      return response.data;
    } catch (ex) {
      throw new Error(this.handleApiError(ex));
    }
  }

  // Main function to get context items (channels and messages)
  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const result = [] as Array<ContextItem>;

    try {
      // Fetch channels
      const channels = await this.fetchChannels(extras);

      // Fetch messages for each channel in parallel
      const channelMessagePromises = channels.map(async (channel) => {
        const messages = await this.fetchMessages(channel.id, extras);
        const parts = [
          `# Discord Channel: ${channel.name}`,
          ...messages.map(
            (message) =>
              `- ${message.author.username}: ${message.content} (at ${message.timestamp})`,
          ),
        ];

        return {
          name: `Messages from ${channel.name}`,
          content: parts.join("\n"),
          description: `Latest messages from the channel ${channel.name}`,
        };
      });

      const channelMessageItems = await Promise.all(channelMessagePromises);
      result.push(...channelMessageItems);
    } catch (ex) {
      result.push({
        name: "Discord Error",
        content: this.handleApiError(ex),
        description: "Error fetching data from Discord.",
      });
    }

    return result;
  }
}

export default DiscordContextProvider;
