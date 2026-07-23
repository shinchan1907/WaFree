import { db } from '../db/index.js';
import { aiReply, isAiConfigured } from '../ai.js';
import { matchesKeywords } from './autoReply.js';
import { getManager, AUTOMATION_USER_ID } from './index.js';
import { logStatusChange } from './assignment.js';

/** Flow format produced by the visual builder (React Flow compatible). */
export interface FlowNode {
  id: string;
  type: 'trigger' | 'condition' | 'reply' | 'ai' | 'delay' | 'tag' | 'status';
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface Flow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface BotRow {
  id: number;
  account_id: number | null;
  name: string;
  enabled: number;
  flow: string;
}

const MAX_STEPS = 25;
const MAX_DELAY_SECONDS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function nextNodes(flow: Flow, nodeId: string, handle?: string): FlowNode[] {
  return flow.edges
    .filter((e) => e.source === nodeId && (handle === undefined || (e.sourceHandle ?? 'out') === handle))
    .map((e) => flow.nodes.find((n) => n.id === e.target))
    .filter((n): n is FlowNode => Boolean(n));
}

function triggerMatches(node: FlowNode, text: string): boolean {
  const mode = String(node.data.mode ?? 'any');
  if (mode === 'any') return true;
  return matchesKeywords(
    {
      trigger_type: 'keyword',
      keywords: String(node.data.keywords ?? ''),
      match_mode: (node.data.match_mode as 'contains' | 'exact' | 'starts') ?? 'contains'
    },
    text
  );
}

async function executeNode(
  node: FlowNode,
  accountId: number,
  jid: string,
  text: string
): Promise<{ handle?: string }> {
  const manager = getManager();
  switch (node.type) {
    case 'reply': {
      const reply = String(node.data.text ?? '').trim();
      if (reply) await manager.sendText(accountId, jid, reply, AUTOMATION_USER_ID);
      return {};
    }
    case 'ai': {
      if (!isAiConfigured()) return {};
      const reply = await aiReply(accountId, jid, String(node.data.prompt ?? ''));
      if (reply) await manager.sendText(accountId, jid, reply, AUTOMATION_USER_ID);
      return {};
    }
    case 'delay': {
      const seconds = Math.min(Number(node.data.seconds) || 1, MAX_DELAY_SECONDS);
      await sleep(seconds * 1000);
      return {};
    }
    case 'condition': {
      const needle = String(node.data.contains ?? '').toLowerCase();
      const yes = needle !== '' && text.toLowerCase().includes(needle);
      return { handle: yes ? 'yes' : 'no' };
    }
    case 'tag': {
      const tagId = Number(node.data.tagId);
      if (tagId) {
        db.prepare(`INSERT OR IGNORE INTO chat_tags (account_id, jid, tag_id) VALUES (?, ?, ?)`).run(
          accountId,
          jid,
          tagId
        );
        manager.broadcastChat(accountId, jid);
      }
      return {};
    }
    case 'status': {
      const status = String(node.data.status ?? '');
      if (['pending', 'ongoing', 'resolved'].includes(status)) {
        db.prepare(`UPDATE chats SET status = ? WHERE account_id = ? AND jid = ?`).run(status, accountId, jid);
        logStatusChange(accountId, jid, status, AUTOMATION_USER_ID);
        manager.broadcastChat(accountId, jid);
      }
      return {};
    }
    default:
      return {};
  }
}

async function runFlow(flow: Flow, accountId: number, jid: string, text: string): Promise<boolean> {
  const triggers = flow.nodes.filter((n) => n.type === 'trigger');
  const matched = triggers.find((t) => triggerMatches(t, text));
  if (!matched) return false;

  let queue = nextNodes(flow, matched.id);
  let steps = 0;
  while (queue.length > 0 && steps < MAX_STEPS) {
    const node = queue.shift()!;
    steps++;
    try {
      const { handle } = await executeNode(node, accountId, jid, text);
      queue.push(...(node.type === 'condition' ? nextNodes(flow, node.id, handle) : nextNodes(flow, node.id)));
    } catch (err) {
      console.warn(`[bot] node ${node.type}(${node.id}) failed:`, (err as Error).message);
    }
  }
  return true;
}

/** Runs enabled bots for an incoming message. Returns true if any bot flow triggered. */
export async function runBots(accountId: number, jid: string, text: string, isGroup: boolean): Promise<boolean> {
  if (isGroup) return false;
  const bots = db
    .prepare(`SELECT * FROM bots WHERE enabled = 1 AND (account_id IS NULL OR account_id = ?) ORDER BY id`)
    .all(accountId) as BotRow[];

  for (const bot of bots) {
    try {
      const flow = JSON.parse(bot.flow) as Flow;
      if (!Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) continue;
      if (await runFlow(flow, accountId, jid, text)) return true;
    } catch (err) {
      console.warn(`[bot] "${bot.name}" failed:`, (err as Error).message);
    }
  }
  return false;
}
