import { Core } from "./core";
import { initSentry, createSpan, captureException } from "./util/sentry";

/**
 * This is an example showing how to integrate Sentry into the Core class.
 * 
 * In a real implementation, you would modify the actual Core.ts file
 * to include these changes.
 */
export class CoreWithSentry extends Core {
  private sentry: any;
  private logger: any;

  constructor(messenger: any, ide: any) {
    super(messenger, ide);
    
    // Initialize Sentry
    const { Sentry, logger } = initSentry(
      process.env.SENTRY_DSN,
      process.env.NODE_ENV,
      process.env.npm_package_version
    );
    
    this.sentry = Sentry;
    this.logger = logger;
    
    if (this.sentry) {
      // Set user information if available
      this.configHandler.controlPlaneClient.getSessionInfo().then(sessionInfo => {
        if (sessionInfo?.user) {
          this.sentry.setUser({
            id: sessionInfo.user.id,
            email: sessionInfo.user.email,
          });
        }
      }).catch(err => {
        console.error("Failed to set Sentry user context", err);
      });
    }
  }

  // Example of wrapping a Core method with Sentry monitoring
  private registerMessageHandlers(ideSettingsPromise: Promise<any>): void {
    const on = this.messenger.on.bind(this.messenger);

    this.messenger.onError((message, err) => {
      // Capture messenger errors in Sentry
      if (this.sentry) {
        captureException(err, { 
          messageType: message.messageType,
          messageId: message.messageId
        });
      }
      
      // Original error handling
      void Telemetry.capture("core_messenger_error", {
        message: err.message,
        stack: err.stack,
      });

      if (["llm/streamChat", "chatDescriber/describe"].includes(message.messageType)) {
        return;
      } else {
        void this.ide.showToast("error", err.message);
      }
    });

    // Example of wrapping an LLM call with performance monitoring
    on("llm/streamChat", (msg) => {
      const abortController = this.addMessageAbortController(msg.messageId);
      
      // Wrap with Sentry performance monitoring
      return createSpan(
        "llm.chat", 
        "Stream Chat",
        () => llmStreamChat(
          this.configHandler,
          abortController,
          msg,
          this.ide,
          this.messenger
        )
      );
    });

    // Add other message handlers with similar patterns
    // ...
  }

  // Example of using structured logging
  private async handleToolCall(toolCall: any) {
    try {
      this.logger.info("Tool call started", { 
        toolName: toolCall.function.name 
      });
      
      const result = await createSpan(
        "tool.execution",
        `Tool: ${toolCall.function.name}`,
        async () => {
          // Original implementation
          const { config } = await this.configHandler.loadConfig();
          if (!config) {
            throw new Error("Config not loaded");
          }
          
          const tool = config.tools.find(t => t.function.name === toolCall.function.name);
          if (!tool) {
            throw new Error(`Tool ${toolCall.function.name} not found`);
          }
          
          // Original implementation...
          return {}; // Placeholder for the actual implementation
        }
      );
      
      this.logger.info("Tool call completed", { 
        toolName: toolCall.function.name 
      });
      
      return result;
    } catch (error) {
      this.logger.error("Tool call failed", {
        toolName: toolCall.function.name,
        error: error instanceof Error ? error.message : String(error)
      });
      
      captureException(
        error instanceof Error ? error : new Error(String(error)), 
        { toolCall }
      );
      
      throw error;
    }
  }
}