import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../api';
import type { Bot, Tag } from '../types';

type NodeKind = 'trigger' | 'condition' | 'reply' | 'ai' | 'delay' | 'tag' | 'status';

const NODE_META: Record<NodeKind, { label: string; icon: string; color: string; hint: string }> = {
  trigger: { label: 'Trigger', icon: '⚡', color: '#00a884', hint: 'Starts the flow on incoming message' },
  condition: { label: 'Condition', icon: '🔀', color: '#f5b642', hint: 'Branch: message contains text?' },
  reply: { label: 'Send reply', icon: '💬', color: '#53bdeb', hint: 'Send a text message' },
  ai: { label: 'AI reply', icon: '🤖', color: '#9b7ded', hint: 'Generate reply with AI' },
  delay: { label: 'Delay', icon: '⏳', color: '#8696a0', hint: 'Wait before next step' },
  tag: { label: 'Add tag', icon: '🏷️', color: '#e9557b', hint: 'Tag this conversation' },
  status: { label: 'Set status', icon: '📌', color: '#fa6533', hint: 'Change chat status' }
};

function summarize(kind: NodeKind, data: Record<string, unknown>, tags: Tag[]): string {
  switch (kind) {
    case 'trigger':
      return data.mode === 'keyword' ? `Keywords: ${data.keywords || '—'}` : 'Any incoming message';
    case 'condition':
      return `contains "${data.contains ?? ''}"`;
    case 'reply':
      return String(data.text ?? '').slice(0, 60) || 'No text set';
    case 'ai':
      return String(data.prompt ?? '').slice(0, 60) || 'Default AI behaviour';
    case 'delay':
      return `${data.seconds ?? 1}s`;
    case 'tag':
      return tags.find((t) => t.id === Number(data.tagId))?.name ?? 'Pick a tag';
    case 'status':
      return String(data.status ?? 'pick one');
    default:
      return '';
  }
}

function FlowNodeView({ id, type, data, selected }: NodeProps) {
  const kind = type as NodeKind;
  const meta = NODE_META[kind];
  const tags = (data.__tags as Tag[]) ?? [];
  return (
    <div className={`flow-node ${selected ? 'selected' : ''}`} style={{ borderColor: meta.color }}>
      {kind !== 'trigger' && <Handle type="target" position={Position.Left} />}
      <div className="flow-node-head" style={{ background: `${meta.color}22`, color: meta.color }}>
        <span>{meta.icon}</span> {meta.label}
      </div>
      <div className="flow-node-body">{summarize(kind, data, tags)}</div>
      {kind === 'condition' ? (
        <>
          <Handle type="source" position={Position.Right} id="yes" style={{ top: '35%' }} />
          <Handle type="source" position={Position.Right} id="no" style={{ top: '75%' }} />
          <span className="handle-label yes">yes</span>
          <span className="handle-label no">no</span>
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
      <span className="flow-node-id">{id}</span>
    </div>
  );
}

const nodeTypes = {
  trigger: FlowNodeView,
  condition: FlowNodeView,
  reply: FlowNodeView,
  ai: FlowNodeView,
  delay: FlowNodeView,
  tag: FlowNodeView,
  status: FlowNodeView
};

export default function BotEditor() {
  const { botId } = useParams();
  const [bot, setBot] = useState<Bot | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [counter, setCounter] = useState(1);

  useEffect(() => {
    Promise.all([api.get<Bot>(`/api/automation/bots/${botId}`), api.get<Tag[]>('/api/tags')])
      .then(([b, t]) => {
        setBot(b.data);
        setTags(t.data);
        setNodes(
          b.data.flow.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: { ...n.data, __tags: t.data }
          }))
        );
        setEdges(
          b.data.flow.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? undefined,
            animated: true
          }))
        );
        setCounter(b.data.flow.nodes.length + 1);
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  const addNode = (kind: NodeKind) => {
    const defaults: Record<NodeKind, Record<string, unknown>> = {
      trigger: { mode: 'any', keywords: '', match_mode: 'contains' },
      condition: { contains: '' },
      reply: { text: '' },
      ai: { prompt: '' },
      delay: { seconds: 3 },
      tag: { tagId: tags[0]?.id ?? 0 },
      status: { status: 'ongoing' }
    };
    const id = `${kind}-${counter}`;
    setCounter((c) => c + 1);
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: kind,
        position: { x: 140 + ((counter * 60) % 400), y: 80 + ((counter * 90) % 320) },
        data: { ...defaults[kind], __tags: tags }
      }
    ]);
    setSelectedId(id);
  };

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  const updateSelected = (patch: Record<string, unknown>) => {
    if (!selectedId) return;
    setNodes((nds) => (nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n))));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const save = async () => {
    setMessage('');
    const flow = {
      nodes: nodes.map((n) => {
        const { __tags, ...data } = n.data as Record<string, unknown>;
        return { id: n.id, type: n.type, position: n.position, data };
      }),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null }))
    };
    try {
      await api.patch(`/api/automation/bots/${botId}`, { flow });
      setMessage('Flow saved ✓');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const toggleEnabled = async () => {
    if (!bot) return;
    await api.patch(`/api/automation/bots/${bot.id}`, { enabled: !bot.enabled }).catch(console.error);
    setBot({ ...bot, enabled: bot.enabled ? 0 : 1 });
  };

  if (!bot) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    );
  }

  const kind = (selected?.type ?? null) as NodeKind | null;
  const data = (selected?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="bot-editor">
      <header className="bot-editor-header">
        <Link to="/admin" className="back-link">
          ← Admin
        </Link>
        <strong>{bot.name}</strong>
        <span className="muted">{bot.account_id ? 'Single account' : 'All WhatsApps'}</span>
        <div className="bot-editor-actions">
          {message && <span className="muted">{message}</span>}
          <button className={`toggle ${bot.enabled ? 'on' : ''}`} onClick={() => void toggleEnabled()} title="Enable bot">
            <span />
          </button>
          <span className="muted">{bot.enabled ? 'Live' : 'Off'}</span>
          <button className="btn-primary" onClick={() => void save()}>
            Save flow
          </button>
        </div>
      </header>

      <div className="bot-editor-main">
        <aside className="node-palette">
          <div className="palette-title">Add step</div>
          {(Object.keys(NODE_META) as NodeKind[]).map((k) => (
            <button key={k} className="palette-item" onClick={() => addNode(k)} title={NODE_META[k].hint}>
              <span>{NODE_META[k].icon}</span> {NODE_META[k].label}
            </button>
          ))}
          <div className="palette-help">
            Connect nodes by dragging from the right handle to the left handle of the next step. Conditions have
            separate <em>yes</em>/<em>no</em> outputs.
          </div>
        </aside>

        <div className="flow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            colorMode="dark"
            deleteKeyCode={['Delete', 'Backspace']}
          >
            <Background gap={22} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>

        {selected && kind && (
          <aside className="node-config">
            <div className="palette-title">
              {NODE_META[kind].icon} {NODE_META[kind].label}
            </div>
            {kind === 'trigger' && (
              <>
                <label className="settings-field">
                  <span>Trigger on</span>
                  <select value={String(data.mode ?? 'any')} onChange={(e) => updateSelected({ mode: e.target.value })}>
                    <option value="any">Any incoming message</option>
                    <option value="keyword">Keyword match</option>
                  </select>
                </label>
                {data.mode === 'keyword' && (
                  <>
                    <label className="settings-field">
                      <span>Keywords (comma separated)</span>
                      <input
                        value={String(data.keywords ?? '')}
                        onChange={(e) => updateSelected({ keywords: e.target.value })}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Match mode</span>
                      <select
                        value={String(data.match_mode ?? 'contains')}
                        onChange={(e) => updateSelected({ match_mode: e.target.value })}
                      >
                        <option value="contains">Contains</option>
                        <option value="exact">Exact</option>
                        <option value="starts">Starts with</option>
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            {kind === 'condition' && (
              <label className="settings-field">
                <span>Message contains</span>
                <input value={String(data.contains ?? '')} onChange={(e) => updateSelected({ contains: e.target.value })} />
              </label>
            )}
            {kind === 'reply' && (
              <label className="settings-field">
                <span>Reply text</span>
                <textarea rows={5} value={String(data.text ?? '')} onChange={(e) => updateSelected({ text: e.target.value })} />
              </label>
            )}
            {kind === 'ai' && (
              <label className="settings-field">
                <span>Extra AI instructions</span>
                <textarea
                  rows={5}
                  value={String(data.prompt ?? '')}
                  onChange={(e) => updateSelected({ prompt: e.target.value })}
                  placeholder="Qualify the lead: ask for their budget and timeline."
                />
              </label>
            )}
            {kind === 'delay' && (
              <label className="settings-field">
                <span>Wait (seconds, max 300)</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={Number(data.seconds ?? 3)}
                  onChange={(e) => updateSelected({ seconds: Number(e.target.value) })}
                />
              </label>
            )}
            {kind === 'tag' && (
              <label className="settings-field">
                <span>Tag to add</span>
                <select value={String(data.tagId ?? '')} onChange={(e) => updateSelected({ tagId: Number(e.target.value) })}>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  {tags.length === 0 && <option value="">No tags — create one first</option>}
                </select>
              </label>
            )}
            {kind === 'status' && (
              <label className="settings-field">
                <span>Set chat status to</span>
                <select value={String(data.status ?? 'ongoing')} onChange={(e) => updateSelected({ status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="ongoing">On-going</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
            )}
            <button className="btn-danger" onClick={deleteSelected} style={{ marginTop: 12 }}>
              Delete node
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
