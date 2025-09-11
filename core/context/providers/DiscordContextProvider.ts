import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
  ContextSubmenuItem,
  FetchFunction,
  LoadSubmenuItemsArgs,
} from "../../index.js";
import { BaseContextProvider } from "../index.js";

//Define helper interfaces for Discord responses
export interface DiscordChannel {
  id: string;
  name?: string;
  icon?: string;
  topic?: string;
  type?: number;
  guild_id?: string;
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
  static description: ContextProviderDescription = {
    title: "discord",
    displayTitle: "Discord",
    description: "Select a channel",
    type: "submenu",
  };

  private baseUrl = "https://discord.com/api/v10";

  // Helper function to get the full fetch URL
  private getUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  get deprecationMessage() {
    return "The Discord context provider is now deprecated and may be removed in a later version. Please consider using the Discord MCP (hub.docker.com/r/mcp/mcp-discord) instead.";
  }

  async fetchMessages(
    channelId: string,
    fetch: FetchFunction,
  ): Promise<Array<DiscordMessage>> {
    const url = this.getUrl(`/channels/${channelId}/messages`);
    // Fetch messages from the specified channel using the provided fetch function
    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${this.options.discordKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch messages: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchChannels(fetch: FetchFunction): Promise<Array<DiscordChannel>> {
    const url = this.getUrl(`/guilds/${this.options.guildId}/channels`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${this.options.discordKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch channels: ${response.statusText}`);
    }

    const channels = await response.json();
    // Filter channels to only include text channels (type 0)
    return channels.filter((channel: DiscordChannel) => channel.type === 0);
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const channels = await this.fetchChannels(extras.fetch);

    let channelId: string;
    // Find the channel by ID or name in the query string. If not found, use the first channel
    const selectedChannel = channels.find(
      (channel) => channel.id === query || channel.name === query,
    );

    channelId = selectedChannel ? selectedChannel.id : channels[0].id;

    const parts = ["# Discord Channel Messages", `Channel ID: ${channelId}`];
    const messages = await this.fetchMessages(channelId, extras.fetch);

    if (messages.length > 0) {
      parts.push("## Messages");
      // Format each message into a markdown string
      messages.forEach((message) => {
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

  async loadSubmenuItems(
    args: LoadSubmenuItemsArgs,
  ): Promise<ContextSubmenuItem[]> {
    const channels = await this.fetchChannels(args.fetch);

    return channels.map((channel) => ({
      id: channel.id,
      title: channel.name || `Channel ${channel.id}`,
      description: channel.topic ?? "",
    }));
  }
}

export default DiscordContextProvider;
