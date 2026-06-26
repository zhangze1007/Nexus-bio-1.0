/**
 * Copilot services — barrel export.
 */

export {
  ConversationManager,
  type Conversation,
  type CopilotMessage,
  type ToolCall,
} from "./conversationManager";

export {
  buildSystemPrompt,
  COPILOT_TOOL_CATALOG,
  type CopilotContext,
} from "./copilotPrompt";

export {
  executeToolCall,
  extractToolCall,
  type ToolCallRequest,
  type ToolCallResult,
} from "./toolCaller";
