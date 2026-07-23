export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'executive';
}

export interface AdminUser extends User {
  is_active: number;
  created_at: string;
  account_ids: number[];
}

export interface Agent {
  id: number;
  name: string;
  username: string;
}

export type AccountStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'logged_out';

export interface Account {
  id: number;
  label: string;
  color: string;
  phone: string | null;
  status: AccountStatus;
  max_agents: number;
  auto_assign?: number;
  agents: Agent[];
}

export type ChatStatus = 'pending' | 'ongoing' | 'resolved';

export interface Chat {
  account_id: number;
  jid: string;
  name: string | null;
  last_message_at: number | null;
  last_message_preview: string | null;
  unread_count: number;
  status: ChatStatus;
  assigned_user_id: number | null;
  tag_ids?: number[];
}

export interface Message {
  msg_id: string;
  from_me: number | boolean;
  sender_jid: string | null;
  sender_name: string | null;
  type: string;
  text: string | null;
  timestamp: number;
  sent_by_user_id?: number | null;
  status?: 'sent' | 'delivered' | 'read';
}

export interface QuickReply {
  id: number;
  account_id: number | null;
  shortcut: string;
  text: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface ScheduledMessage {
  id: number;
  account_id: number;
  chat_jid: string;
  text: string;
  send_at: number;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error: string | null;
  account_label?: string;
  created_by_name?: string;
  chat_name?: string | null;
}

export interface AutoReply {
  id: number;
  account_id: number | null;
  name: string;
  enabled: number;
  trigger_type: 'keyword' | 'all';
  keywords: string | null;
  match_mode: 'contains' | 'exact' | 'starts';
  response_type: 'text' | 'ai';
  reply_text: string | null;
  ai_prompt: string | null;
  cooldown_minutes: number;
  only_individual: number;
}

export interface BotFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface BotFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface Bot {
  id: number;
  account_id: number | null;
  name: string;
  enabled: number;
  flow: { nodes: BotFlowNode[]; edges: BotFlowEdge[] };
  updated_at: string;
}

export type AppSettings = Record<string, string>;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: { hasMore?: boolean };
}
