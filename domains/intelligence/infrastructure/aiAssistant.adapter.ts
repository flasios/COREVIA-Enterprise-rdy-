/**
 * Intelligence — AI Assistant Service adapter
 */
import type { AIAssistantServicePort, ConversationMessageDto } from "../domain/ports";
import { aiAssistantService } from "./aiAssistantService";

export class LegacyAIAssistantService implements AIAssistantServicePort {
  private get svc() {
    return aiAssistantService;
  }

  async quickChat(
    message: string,
    userId: string,
    userName: string,
    isFirstMessage: boolean,
    history: ConversationMessageDto[],
    context: string,
  ) {
    return this.svc.quickChat(
      message,
      userId,
      userName,
      isFirstMessage,
      history as unknown as Array<{ role: "user" | "assistant"; content: string }>,
      context,
    );
  }

  async quickChatStream(
    message: string,
    userId: string,
    userName: string,
    isFirstMessage: boolean,
    history: ConversationMessageDto[],
    context: string,
    writeToken: (text: string) => void,
    onEvent?: (e: { type: 'tool_start' | 'tool_done' | 'action' | 'follow_ups' | 'file_ready'; name: string; summary?: string; items?: string[]; url?: string; filename?: string; format?: string }) => void,
    entityId?: string,
  ): Promise<void> {
    return this.svc.quickChatStream(
      message,
      userId,
      userName,
      isFirstMessage,
      history as unknown as Array<{ role: "user" | "assistant"; content: string }>,
      context,
      writeToken,
      onEvent,
      entityId,
    );
  }

  async executeApprovedAction(
    prompt: string,
    userId: string,
    userName: string,
    context: string,
    idempotencyKey?: string,
    preselectedToolCalls?: Array<{ name: string; input: Record<string, unknown> }>,
  ) {
    return this.svc.executeApprovedAction(prompt, userId, userName, context, idempotencyKey, preselectedToolCalls);
  }

  async createConversation(
    userId: string,
    title?: string,
    mode?: string,
    contextType?: string,
    contextId?: string,
  ) {
    return this.svc.createConversation(userId, title, mode, contextType, contextId);
  }

  async getConversations(userId: string) {
    return this.svc.getConversations(userId);
  }

  async getConversation(id: string) {
    return this.svc.getConversation(id);
  }

  async getMessages(conversationId: string) {
    return this.svc.getMessages(conversationId);
  }

  async chat(conversationId: string, message: string, userId: string, userName: string) {
    return this.svc.chat(conversationId, message, userId, userName);
  }

  async archiveConversation(id: string): Promise<void> {
    await this.svc.archiveConversation(id);
  }

  async getNotifications(userId: string, unreadOnly: boolean) {
    return this.svc.getNotifications(userId, unreadOnly);
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.svc.markNotificationRead(id);
  }

  async dismissNotification(id: string): Promise<void> {
    await this.svc.dismissNotification(id);
  }

  async getProactiveInsights(userId: string) {
    return this.svc.getProactiveInsights(userId);
  }
}
