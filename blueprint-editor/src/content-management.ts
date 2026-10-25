import {
  emptyPresentation,
  validatePresentation,
  validateDraftGraph,
  type Graph,
  type Node,
  type EditorPresentation,
  type GraphBookmark
} from '../../rp-gamemode/src/modules/dialogue/graph-model';
import {edgesFromNodes, type Canvas, type Layout} from './mapping';

// ============================================================================
// C3.1 — Visual Version Diff
// ============================================================================

export interface VersionSnapshotInput {
  label: string;
  version?: number;
  revision?: number;
  graph: Graph;
  layout?: Layout;
  presentation?: EditorPresentation;
}

export interface NodeFieldChange {
  field: 'type' | 'text' | 'action' | 'argument' | 'condition' | 'next' | 'otherwise' | 'choices';
  before: string;
  after: string;
}

export interface ModifiedNodeDiff {
  nodeId: string;
  nodeType: Node['type'];
  beforeNode: Node;
  afterNode: Node;
  changes: NodeFieldChange[];
}

export interface RemovedNodeDiff {
  nodeId: string;
  nodeType: Node['type'];
  historicalNode: Node;
  historicalPosition?: {x: number; y: number};
}

export interface AddedNodeDiff {
  nodeId: string;
  nodeType: Node['type'];
  node: Node;
}

export interface EdgeDiffItem {
  edgeId: string;
  source: string;
  sourceHandle: string;
  beforeTarget?: string;
  afterTarget?: string;
  kind: 'added' | 'removed' | 'changed';
}

export interface PresentationDiffItem {
  kind: 'layout' | 'group' | 'bookmark';
  id: string;
  summary: string;
}

export interface GraphVersionDiff {
  baseLabel: string;
  targetLabel: string;
  identicalExecutable: boolean;
  identicalPresentation: boolean;
  addedNodes: AddedNodeDiff[];
  removedNodes: RemovedNodeDiff[];
  modifiedNodes: ModifiedNodeDiff[];
  edgeDiffs: EdgeDiffItem[];
  presentationDiffs: PresentationDiffItem[];
  summaryText: string;
}

function summarizeChoices(choices: Node['choices']): string {
  if (!choices?.length) return '(none)';
  return choices.map(c => `${c.id}:"${c.text}"→${c.next || 'unlinked'}`).join('; ');
}

export function diffGraphVersions(
  base: VersionSnapshotInput,
  target: VersionSnapshotInput
): GraphVersionDiff {
  const baseNodes = new Map(base.graph.nodes.map(n => [n.id, n]));
  const targetNodes = new Map(target.graph.nodes.map(n => [n.id, n]));

  const addedNodes: AddedNodeDiff[] = [];
  const removedNodes: RemovedNodeDiff[] = [];
  const modifiedNodes: ModifiedNodeDiff[] = [];

  for (const [id, afterNode] of targetNodes.entries()) {
    const beforeNode = baseNodes.get(id);
    if (!beforeNode) {
      addedNodes.push({
        nodeId: id,
        nodeType: afterNode.type,
        node: structuredClone(afterNode)
      });
      continue;
    }
    const changes: NodeFieldChange[] = [];
    if (beforeNode.type !== afterNode.type) {
      changes.push({field: 'type', before: beforeNode.type, after: afterNode.type});
    }
    if ((beforeNode.text ?? '') !== (afterNode.text ?? '')) {
      changes.push({field: 'text', before: beforeNode.text ?? '', after: afterNode.text ?? ''});
    }
    if ((beforeNode.action ?? '') !== (afterNode.action ?? '')) {
      changes.push({field: 'action', before: beforeNode.action ?? '', after: afterNode.action ?? ''});
    }
    if ((beforeNode.argument ?? '') !== (afterNode.argument ?? '')) {
      changes.push({
        field: 'argument',
        before: beforeNode.argument ?? '',
        after: afterNode.argument ?? ''
      });
    }
    if ((beforeNode.condition ?? '') !== (afterNode.condition ?? '')) {
      changes.push({
        field: 'condition',
        before: beforeNode.condition ?? '',
        after: afterNode.condition ?? ''
      });
    }
    if ((beforeNode.next ?? '') !== (afterNode.next ?? '')) {
      changes.push({field: 'next', before: beforeNode.next ?? '', after: afterNode.next ?? ''});
    }
    if ((beforeNode.otherwise ?? '') !== (afterNode.otherwise ?? '')) {
      changes.push({
        field: 'otherwise',
        before: beforeNode.otherwise ?? '',
        after: afterNode.otherwise ?? ''
      });
    }
    const beforeChoicesStr = summarizeChoices(beforeNode.choices);
    const afterChoicesStr = summarizeChoices(afterNode.choices);
    if (beforeChoicesStr !== afterChoicesStr) {
      changes.push({field: 'choices', before: beforeChoicesStr, after: afterChoicesStr});
    }
    if (changes.length > 0) {
      modifiedNodes.push({
        nodeId: id,
        nodeType: afterNode.type,
        beforeNode: structuredClone(beforeNode),
        afterNode: structuredClone(afterNode),
        changes
      });
    }
  }

  for (const [id, beforeNode] of baseNodes.entries()) {
    if (!targetNodes.has(id)) {
      removedNodes.push({
        nodeId: id,
        nodeType: beforeNode.type,
        historicalNode: structuredClone(beforeNode),
        historicalPosition: base.layout?.[id] ? {...base.layout[id]!} : undefined
      });
    }
  }

  // Edge diffs matched by stable source + sourceHandle key (edge.id)
  const baseEdges = new Map(edgesFromNodes(base.graph.nodes).map(e => [e.id, e]));
  const targetEdges = new Map(edgesFromNodes(target.graph.nodes).map(e => [e.id, e]));
  const edgeDiffs: EdgeDiffItem[] = [];

  for (const [edgeId, afterEdge] of targetEdges.entries()) {
    const beforeEdge = baseEdges.get(edgeId);
    if (!beforeEdge) {
      edgeDiffs.push({
        edgeId,
        source: afterEdge.source,
        sourceHandle: afterEdge.sourceHandle ?? 'next',
        afterTarget: afterEdge.target,
        kind: 'added'
      });
    } else if (beforeEdge.target !== afterEdge.target) {
      edgeDiffs.push({
        edgeId,
        source: afterEdge.source,
        sourceHandle: afterEdge.sourceHandle ?? 'next',
        beforeTarget: beforeEdge.target,
        afterTarget: afterEdge.target,
        kind: 'changed'
      });
    }
  }
  for (const [edgeId, beforeEdge] of baseEdges.entries()) {
    if (!targetEdges.has(edgeId)) {
      edgeDiffs.push({
        edgeId,
        source: beforeEdge.source,
        sourceHandle: beforeEdge.sourceHandle ?? 'next',
        beforeTarget: beforeEdge.target,
        kind: 'removed'
      });
    }
  }

  // Presentation & layout-only diffs (strictly separated from executable changes)
  const presentationDiffs: PresentationDiffItem[] = [];
  const baseLayout = base.layout ?? {};
  const targetLayout = target.layout ?? {};
  const allLayoutIds = new Set([...Object.keys(baseLayout), ...Object.keys(targetLayout)]);
  for (const id of allLayoutIds) {
    const bPos = baseLayout[id];
    const tPos = targetLayout[id];
    if (bPos && tPos && (Math.round(bPos.x) !== Math.round(tPos.x) || Math.round(bPos.y) !== Math.round(tPos.y))) {
      presentationDiffs.push({
        kind: 'layout',
        id,
        summary: `Node ${id} moved from (${Math.round(bPos.x)}, ${Math.round(bPos.y)}) to (${Math.round(tPos.x)}, ${Math.round(tPos.y)})`
      });
    }
  }

  const basePres = base.presentation ?? emptyPresentation();
  const targetPres = target.presentation ?? emptyPresentation();
  const baseGroups = new Map(basePres.groups.map(g => [g.id, g]));
  const targetGroups = new Map(targetPres.groups.map(g => [g.id, g]));
  for (const [id, grp] of targetGroups.entries()) {
    const old = baseGroups.get(id);
    if (!old) {
      presentationDiffs.push({kind: 'group', id, summary: `Added visual group "${grp.title}" (${id})`});
    } else if (JSON.stringify(old) !== JSON.stringify(grp)) {
      presentationDiffs.push({kind: 'group', id, summary: `Modified visual group "${grp.title}" (${id})`});
    }
  }
  for (const [id, old] of baseGroups.entries()) {
    if (!targetGroups.has(id)) {
      presentationDiffs.push({kind: 'group', id, summary: `Removed visual group "${old.title}" (${id})`});
    }
  }

  const baseBookmarks = new Map(basePres.bookmarks.map(b => [b.id, b]));
  const targetBookmarks = new Map(targetPres.bookmarks.map(b => [b.id, b]));
  for (const [id, bm] of targetBookmarks.entries()) {
    const old = baseBookmarks.get(id);
    if (!old) {
      presentationDiffs.push({kind: 'bookmark', id, summary: `Added bookmark "${bm.name}" (${id})`});
    } else if (JSON.stringify(old) !== JSON.stringify(bm)) {
      presentationDiffs.push({kind: 'bookmark', id, summary: `Modified bookmark "${bm.name}" (${id})`});
    }
  }
  for (const [id, old] of baseBookmarks.entries()) {
    if (!targetBookmarks.has(id)) {
      presentationDiffs.push({kind: 'bookmark', id, summary: `Removed bookmark "${old.name}" (${id})`});
    }
  }

  const identicalExecutable =
    addedNodes.length === 0 &&
    removedNodes.length === 0 &&
    modifiedNodes.length === 0 &&
    edgeDiffs.length === 0 &&
    base.graph.entry === target.graph.entry;
  const identicalPresentation = presentationDiffs.length === 0;

  const summaryText =
    identicalExecutable && identicalPresentation
      ? 'No executable or presentation differences.'
      : identicalExecutable
        ? `Executable graph is identical (${presentationDiffs.length} layout/presentation-only change(s)).`
        : `+${addedNodes.length} added · −${removedNodes.length} removed · ~${modifiedNodes.length} modified · ${edgeDiffs.length} connection change(s)` +
          (presentationDiffs.length ? ` · ${presentationDiffs.length} presentation change(s)` : '');

  return {
    baseLabel: base.label,
    targetLabel: target.label,
    identicalExecutable,
    identicalPresentation,
    addedNodes,
    removedNodes,
    modifiedNodes,
    edgeDiffs,
    presentationDiffs,
    summaryText
  };
}

// ============================================================================
// C3.2 — Safe Draft Recovery
// ============================================================================

export const RECOVERY_STORAGE_PREFIX = 'fv-draft-recovery-v1:';
export const RECOVERY_DEBOUNCE_MS = 450;

export interface DraftRecoverySnapshot {
  kind: 'frostveil-draft-recovery';
  schemaVersion: 1;
  graphId: string;
  baseRevision: number;
  publishedVersion: number;
  savedAt: string;
  graph: Graph;
  layout: Layout;
  presentation: EditorPresentation;
}

export interface RecoveryConflictAssessment {
  snapshot: DraftRecoverySnapshot;
  hasServerConflict: boolean;
  serverRevision: number;
  serverPublishedVersion: number;
  explanation: string;
}

const FORBIDDEN_SECRET_KEYS = new Set([
  'csrf',
  'grant',
  'token',
  'password',
  'secret',
  'authorization',
  'session',
  'cookie'
]);

function containsForbiddenKeys(input: unknown): boolean {
  if (!input || typeof input !== 'object') return false;
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (FORBIDDEN_SECRET_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}

export function buildRecoverySnapshot(
  graph: Graph,
  layout: Layout,
  presentation: EditorPresentation,
  baseRevision: number,
  publishedVersion: number,
  routes: readonly string[] = [],
  permits: readonly string[] = []
): DraftRecoverySnapshot {
  const validGraph = validateDraftGraph(graph, routes, permits);
  const validPres = validatePresentation(presentation);
  return {
    kind: 'frostveil-draft-recovery',
    schemaVersion: 1,
    graphId: validGraph.id,
    baseRevision: Number.isSafeInteger(baseRevision) && baseRevision >= 0 ? baseRevision : 0,
    publishedVersion:
      Number.isSafeInteger(publishedVersion) && publishedVersion >= 0 ? publishedVersion : 0,
    savedAt: new Date().toISOString(),
    graph: validGraph,
    layout: structuredClone(layout),
    presentation: validPres
  };
}

export function saveRecoverySnapshotToStorage(
  snapshot: DraftRecoverySnapshot,
  storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined
): boolean {
  if (!storage) return false;
  if (containsForbiddenKeys(snapshot)) {
    throw new Error('Refusing to persist recovery snapshot containing authentication or secret keys.');
  }
  try {
    storage.setItem(RECOVERY_STORAGE_PREFIX + snapshot.graphId, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadRecoverySnapshotFromStorage(
  graphId: string,
  routes: readonly string[] = [],
  permits: readonly string[] = [],
  storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined
): DraftRecoverySnapshot | null {
  if (!storage || !graphId) return null;
  try {
    const raw = storage.getItem(RECOVERY_STORAGE_PREFIX + graphId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || containsForbiddenKeys(parsed)) return null;
    if (
      parsed.kind !== 'frostveil-draft-recovery' ||
      parsed.schemaVersion !== 1 ||
      parsed.graphId !== graphId
    ) {
      return null;
    }
    const validGraph = validateDraftGraph(parsed.graph, routes, permits);
    const validPres = parsed.presentation
      ? validatePresentation(parsed.presentation)
      : emptyPresentation();
    const rawLayout = (parsed.layout ?? {}) as Record<string, {x: number; y: number}>;
    const cleanLayout: Layout = {};
    for (const [k, pos] of Object.entries(rawLayout)) {
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        cleanLayout[k] = {x: pos.x, y: pos.y};
      }
    }
    return {
      kind: 'frostveil-draft-recovery',
      schemaVersion: 1,
      graphId: validGraph.id,
      baseRevision:
        typeof parsed.baseRevision === 'number' && Number.isSafeInteger(parsed.baseRevision)
          ? parsed.baseRevision
          : 0,
      publishedVersion:
        typeof parsed.publishedVersion === 'number' && Number.isSafeInteger(parsed.publishedVersion)
          ? parsed.publishedVersion
          : 0,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      graph: validGraph,
      layout: cleanLayout,
      presentation: validPres
    };
  } catch {
    return null;
  }
}

export function clearRecoverySnapshotFromStorage(
  graphId: string,
  storage: Pick<Storage, 'removeItem'> | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined
): void {
  if (!storage || !graphId) return;
  try {
    storage.removeItem(RECOVERY_STORAGE_PREFIX + graphId);
  } catch {}
}

export function assessRecoveryConflict(
  snapshot: DraftRecoverySnapshot,
  serverRevision: number,
  serverPublishedVersion: number,
  serverGraph: Graph
): RecoveryConflictAssessment {
  const sameAsServer = JSON.stringify(snapshot.graph) === JSON.stringify(serverGraph);
  const hasServerConflict =
    snapshot.baseRevision < serverRevision || snapshot.publishedVersion < serverPublishedVersion;
  const explanation = hasServerConflict
    ? `Conflict detected: local recovery snapshot was created at draft r${snapshot.baseRevision} (v${snapshot.publishedVersion}), but the server now has draft r${serverRevision} (v${serverPublishedVersion}). Restoring will stage your recovered nodes on top of r${serverRevision} without overwriting the server until you explicitly click Save draft.`
    : sameAsServer
      ? `Local recovery snapshot matches the current server draft (r${serverRevision}).`
      : `Unsaved local recovery snapshot found from ${snapshot.savedAt.slice(0, 19).replace('T', ' ')} (based on draft r${snapshot.baseRevision}).`;

  return {
    snapshot,
    hasServerConflict,
    serverRevision,
    serverPublishedVersion,
    explanation
  };
}

// ============================================================================
// C3.3 — Find References (Local + Authorized Cross-Graph Indexed)
// ============================================================================

export interface ReferenceMatch {
  scope: 'local' | 'cross-graph';
  graphId: string;
  graphSource: 'published' | 'draft';
  direction: 'incoming' | 'outgoing' | 'self' | 'action-usage' | 'npc-assignment';
  nodeId: string;
  nodeType: Node['type'];
  edgeId?: string;
  choiceId?: string;
  summary: string;
}

export interface ServerReferenceEntry {
  graphId: string;
  source: 'published' | 'draft';
  version: number;
  assignedNpcs: string[];
  nodeId: string;
  nodeType: Node['type'];
  action: Node['action'] | null;
  argument: string | null;
  condition: Node['condition'] | null;
  targets: string[];
  choices: Array<{id: string; text: string; next: string}>;
}

export function findReferences(
  graph: Graph,
  canvas: Canvas,
  queryTarget: {
    nodeId?: string;
    choiceId?: string;
    action?: Node['action'];
    argument?: string;
  },
  crossGraphEntries: readonly ServerReferenceEntry[] = []
): ReferenceMatch[] {
  const results: ReferenceMatch[] = [];
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]));

  if (queryTarget.nodeId) {
    const targetId = queryTarget.nodeId;
    // Incoming connections in current graph
    for (const edge of canvas.edges) {
      if (edge.target === targetId) {
        const src = nodesById.get(edge.source);
        results.push({
          scope: 'local',
          graphId: graph.id,
          graphSource: 'draft',
          direction: 'incoming',
          nodeId: edge.source,
          nodeType: src?.type ?? 'npc',
          edgeId: edge.id,
          summary: `Incoming from ${edge.source} (${edge.sourceHandle ?? 'next'}) → ${targetId}`
        });
      }
      if (edge.source === targetId) {
        const dst = nodesById.get(edge.target);
        results.push({
          scope: 'local',
          graphId: graph.id,
          graphSource: 'draft',
          direction: 'outgoing',
          nodeId: edge.target,
          nodeType: dst?.type ?? 'npc',
          edgeId: edge.id,
          summary: `Outgoing from ${targetId} (${edge.sourceHandle ?? 'next'}) → ${edge.target}`
        });
      }
    }
  }

  if (queryTarget.choiceId) {
    for (const node of graph.nodes) {
      if (node.type === 'choices') {
        for (const ch of node.choices ?? []) {
          if (ch.id === queryTarget.choiceId) {
            const edgeId = `${node.id}:choice:${ch.id}`;
            results.push({
              scope: 'local',
              graphId: graph.id,
              graphSource: 'draft',
              direction: 'outgoing',
              nodeId: node.id,
              nodeType: 'choices',
              edgeId,
              choiceId: ch.id,
              summary: `Choice "${ch.text}" (${ch.id}) on ${node.id} → ${ch.next || 'unlinked'}`
            });
          }
        }
      }
    }
  }

  if (queryTarget.action) {
    for (const node of graph.nodes) {
      if (
        node.type === 'action' &&
        node.action === queryTarget.action &&
        (!queryTarget.argument || node.argument === queryTarget.argument)
      ) {
        results.push({
          scope: 'local',
          graphId: graph.id,
          graphSource: 'draft',
          direction: 'action-usage',
          nodeId: node.id,
          nodeType: 'action',
          summary: `Local action "${node.action}"${node.argument ? ` [${node.argument}]` : ''} on ${node.id}`
        });
      }
    }
  }

  // Cross-graph usages from authorized server index
  for (const entry of crossGraphEntries) {
    if (entry.graphId === graph.id) continue;
    const matchesAction =
      queryTarget.action &&
      entry.action === queryTarget.action &&
      (!queryTarget.argument || entry.argument === queryTarget.argument);
    const matchesNodeId =
      queryTarget.nodeId &&
      (entry.nodeId === queryTarget.nodeId || entry.targets.includes(queryTarget.nodeId));
    const matchesChoiceId =
      queryTarget.choiceId && entry.choices.some(c => c.id === queryTarget.choiceId);

    if (matchesAction || matchesNodeId || matchesChoiceId) {
      results.push({
        scope: 'cross-graph',
        graphId: entry.graphId,
        graphSource: entry.source,
        direction: matchesAction ? 'action-usage' : 'incoming',
        nodeId: entry.nodeId,
        nodeType: entry.nodeType,
        summary: `[${entry.graphId} · ${entry.source}] Node ${entry.nodeId} (${entry.nodeType})${entry.action ? ` · ${entry.action}${entry.argument ? `(${entry.argument})` : ''}` : ''}${entry.assignedNpcs.length ? ` · NPC: ${entry.assignedNpcs.join(', ')}` : ''}`
      });
    }
  }

  return results;
}

// ============================================================================
// C3.4 — Graph Bookmarks
// ============================================================================

export function addGraphBookmark(
  presentation: EditorPresentation,
  options: {
    id?: string;
    name: string;
    nodeId?: string;
    viewport: {x: number; y: number; zoom: number};
  }
): {presentation: EditorPresentation; bookmark: GraphBookmark} {
  if (presentation.bookmarks.length >= 32) {
    throw new Error('Maximum 32 bookmarks per graph');
  }
  const existingIds = new Set(presentation.bookmarks.map(b => b.id));
  let id = options.id ?? `bm-${crypto.randomUUID().slice(0, 8)}`;
  while (existingIds.has(id)) {
    id = `bm-${crypto.randomUUID().slice(0, 8)}`;
  }
  const bookmark: GraphBookmark = {
    id,
    name: (options.name.trim() || `Bookmark ${presentation.bookmarks.length + 1}`).slice(0, 80),
    ...(options.nodeId ? {nodeId: options.nodeId} : {}),
    viewport: {
      x: Math.round(options.viewport.x),
      y: Math.round(options.viewport.y),
      zoom: Number(Math.max(0.01, Math.min(4, options.viewport.zoom)).toFixed(2))
    }
  };
  return {
    presentation: {
      ...presentation,
      bookmarks: [...presentation.bookmarks, bookmark]
    },
    bookmark
  };
}

export function renameGraphBookmark(
  presentation: EditorPresentation,
  bookmarkId: string,
  newName: string
): EditorPresentation {
  const trimmed = newName.trim().slice(0, 80);
  if (!trimmed) return presentation;
  return {
    ...presentation,
    bookmarks: presentation.bookmarks.map(b => (b.id === bookmarkId ? {...b, name: trimmed} : b))
  };
}

export function deleteGraphBookmark(
  presentation: EditorPresentation,
  bookmarkId: string
): EditorPresentation {
  return {
    ...presentation,
    bookmarks: presentation.bookmarks.filter(b => b.id !== bookmarkId)
  };
}

// ============================================================================
// C3.5 — Editor Shortcuts and Help
// ============================================================================

export interface ShortcutEntry {
  keys: string;
  category:
    | 'Node Creation'
    | 'Selection & Clipboard'
    | 'Undo / Redo & Save'
    | 'Search & Navigation'
    | 'Visual Debugger'
    | 'Review & Help';
  action: string;
  thaiDescription: string;
}

export const EDITOR_SHORTCUTS: readonly ShortcutEntry[] = [
  {
    keys: 'Space',
    category: 'Node Creation',
    action: 'Quick Node Creation Palette',
    thaiDescription: 'เปิดเมนูสร้างโหนดด่วนที่ตำแหน่งเมาส์บนแคนวาส'
  },
  {
    keys: 'Drag Output → Empty Canvas',
    category: 'Node Creation',
    action: 'Compatible Node Palette',
    thaiDescription: 'ลากเส้นจากจุดเชื่อมออกไปยังพื้นที่ว่างเพื่อสร้างและเชื่อมโหนดอัตโนมัติ'
  },
  {
    keys: 'Ctrl + K',
    category: 'Search & Navigation',
    action: 'Search Graph Nodes & Dialogue',
    thaiDescription: 'ค้นหาโหนด ข้อความบทพูด หรือตัวเลือกภาษาไทย/อังกฤษ'
  },
  {
    keys: 'Ctrl + B',
    category: 'Search & Navigation',
    action: 'Toggle Node Library',
    thaiDescription: 'เปิด/ซ่อนแผงคลังโหนดและเทมเพลตด้านซ้าย'
  },
  {
    keys: 'Shift / Ctrl + Click',
    category: 'Selection & Clipboard',
    action: 'Multi-select Nodes',
    thaiDescription: 'เลือกหลายโหนดพร้อมกันเพื่อย้าย คัดลอก หรือจัดกลุ่ม'
  },
  {
    keys: 'Ctrl + C / Ctrl + X / Ctrl + V',
    category: 'Selection & Clipboard',
    action: 'Copy / Cut / Paste Selection',
    thaiDescription: 'คัดลอก ตัด และวางโหนดที่เลือกพร้อมสร้าง ID ใหม่อัตโนมัติ'
  },
  {
    keys: 'Ctrl + D',
    category: 'Selection & Clipboard',
    action: 'Duplicate Selection',
    thaiDescription: 'ทำซ้ำโหนดที่เลือกและเส้นเชื่อมภายในชุดที่เลือก'
  },
  {
    keys: 'Ctrl + G',
    category: 'Selection & Clipboard',
    action: 'Create Visual Group Frame',
    thaiDescription: 'สร้างกรอบกลุ่มความคิดเห็น (Visual Group) รอบโหนดที่เลือก'
  },
  {
    keys: 'Delete / Backspace',
    category: 'Selection & Clipboard',
    action: 'Delete Selected Item(s)',
    thaiDescription: 'ลบโหนด เส้นเชื่อม หรือกรอบกลุ่มที่เลือก (พร้อมยืนยัน)'
  },
  {
    keys: 'Ctrl + Z / Ctrl + Shift + Z / Ctrl + Y',
    category: 'Undo / Redo & Save',
    action: 'Undo / Redo Authoring Action',
    thaiDescription: 'ย้อนกลับหรือทำซ้ำการแก้ไขแบบ Atomic Transaction'
  },
  {
    keys: 'Ctrl + S',
    category: 'Undo / Redo & Save',
    action: 'Save Draft',
    thaiDescription: 'บันทึกร่างกราฟและข้อมูลการจัดวางลงเซิร์ฟเวอร์'
  },
  {
    keys: 'Escape',
    category: 'Search & Navigation',
    action: 'Close Modal / Cancel Preview / Clear Trace',
    thaiDescription: 'ปิดหน้าต่างป๊อปอัป ยกเลิกการแทรก/จัดเรียง หรือล้างการเลือก'
  },
  {
    keys: 'F1 / ?',
    category: 'Review & Help',
    action: 'Open Keyboard Shortcuts & Help',
    thaiDescription: 'เปิดหน้าต่างคู่มือคีย์ลัดและการใช้งาน Arcane Workbench'
  }
];

export function isEditableInputTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    );
  }
  const tag = String((target as {tagName?: string}).tagName ?? '').toUpperCase();
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    Boolean((target as {isContentEditable?: boolean}).isContentEditable)
  );
}
