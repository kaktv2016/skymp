import {
  validateGraph,
  validateDraftGraph,
  type Graph,
  type Node
} from '../../rp-gamemode/src/modules/dialogue/graph-model';
import type {Canvas} from './mapping';

const ALLOWLIST_ACTIONS: readonly NonNullable<Node['action']>[] = [
  'contracts',
  'rank',
  'permits',
  'accept',
  'buyPermit'
];
const ALLOWLIST_CONDITIONS: readonly NonNullable<Node['condition']>[] = [
  'always',
  'courierIdle'
];

export interface TestPlayerProfile {
  id: string;
  name: string;
  thaiName: string;
  courierLifecycle: 'idle' | 'active';
  courierRankEligible: boolean;
  courierRankLabel: string;
  ownedPermits: string[];
  walletGold: number;
  customRouteCostGold?: number;
  customPermitCostGold?: number;
}

export const PRESET_PLAYER_PROFILES: readonly TestPlayerProfile[] = [
  {
    id: 'idle-eligible',
    name: 'Idle Courier (Eligible, 500g)',
    thaiName: 'พร้อมรับงาน · ระดับผ่านเกณฑ์ (500 Gold)',
    courierLifecycle: 'idle',
    courierRankEligible: true,
    courierRankLabel: 'Journeyman Courier (Rank 2)',
    ownedPermits: [],
    walletGold: 500
  },
  {
    id: 'active-contract',
    name: 'Active Courier Contract',
    thaiName: 'กำลังส่งพัสดุ (มีสัญญางานค้างอยู่)',
    courierLifecycle: 'active',
    courierRankEligible: true,
    courierRankLabel: 'Journeyman Courier (Rank 2)',
    ownedPermits: ['permit_whiterun_trade'],
    walletGold: 350
  },
  {
    id: 'ineligible-novice',
    name: 'Ineligible Rank / Low Gold (25g)',
    thaiName: 'ระดับยังไม่ถึงเกณฑ์ · ทองไม่พอ (25 Gold)',
    courierLifecycle: 'idle',
    courierRankEligible: false,
    courierRankLabel: 'Unregistered Novice (Rank 0)',
    ownedPermits: [],
    walletGold: 25
  },
  {
    id: 'permit-holder-wealthy',
    name: 'Permit Holder (Wealthy, 2000g)',
    thaiName: 'มีใบอนุญาตครบ · ทองสะสมสูง (2,000 Gold)',
    courierLifecycle: 'idle',
    courierRankEligible: true,
    courierRankLabel: 'Master Courier (Rank 4)',
    ownedPermits: ['permit_whiterun_trade', 'permit_solitude_customs', 'permit_rift_caravan'],
    walletGold: 2000
  }
];

export interface ConditionEvaluationDetail {
  condition: NonNullable<Node['condition']>;
  passed: boolean;
  branchChosen: 'next' | 'otherwise';
  targetNodeId: string;
  explanation: string;
}

export interface SimulatedActionOutcome {
  action: NonNullable<Node['action']>;
  argument?: string;
  simulated: true;
  mutationPerformed: false;
  requiresLiveRuntimeVerification: boolean;
  status: 'simulated-ok' | 'simulated-blocked';
  summary: string;
  verificationNote: string;
}

export interface DebuggerStepRecord {
  stepIndex: number;
  nodeId: string;
  nodeType: Node['type'];
  incomingEdgeId: string | null;
  outgoingEdgeId: string | null;
  expectedNextNodeId: string | null;
  dialogueText?: string;
  chosenChoiceId?: string;
  chosenChoiceText?: string;
  conditionEval?: ConditionEvaluationDetail;
  actionOutcome?: SimulatedActionOutcome;
  error?: string;
}

export type DebuggerRunStatus =
  | 'idle'
  | 'paused'
  | 'awaiting-choice'
  | 'breakpoint'
  | 'completed'
  | 'error';

export interface DebuggerSession {
  status: DebuggerRunStatus;
  profile: TestPlayerProfile;
  breakpoints: string[];
  currentNodeId: string | null;
  activeEdgeId: string | null;
  expectedNextNodeId: string | null;
  visitedNodeIds: string[];
  visitedEdgeIds: string[];
  choiceHistory: string[];
  steps: DebuggerStepRecord[];
  availableChoices: Array<{id: string; text: string; next: string}>;
  error: string | null;
  elapsedMs: number;
  mutationCount: 0;
}

export interface DiagnosticItem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  title: string;
  explanation: string;
  recommendation: string;
  nodeId?: string;
  edgeId?: string;
  blockingPublish: boolean;
}

export interface ScenarioComparisonRow {
  profileId: string;
  profileName: string;
  thaiName: string;
  status: DebuggerRunStatus;
  visitedNodeIds: string[];
  visitedEdgeIds: string[];
  terminalNodeId: string | null;
  simulatedActions: string[];
  conditionBranches: string[];
  error: string | null;
}

const MAX_DEBUGGER_STEPS = 48;
const MAX_DEBUGGER_ELAPSED_MS = 250;

export function findEdgeBetween(
  canvas: Canvas,
  sourceId: string,
  targetId: string,
  sourceHandle: string
): string | null {
  const found = canvas.edges.find(
    e =>
      e.source === sourceId &&
      e.target === targetId &&
      (e.sourceHandle ?? 'next') === sourceHandle
  );
  return found?.id ?? `${sourceId}:${sourceHandle}->${targetId}`;
}

export function evaluateSimulatedCondition(
  node: Node,
  profile: TestPlayerProfile
): ConditionEvaluationDetail {
  const cond = node.condition ?? 'always';
  if (cond === 'courierIdle') {
    const passed = profile.courierLifecycle === 'idle';
    const branchChosen = passed ? 'next' : 'otherwise';
    const targetNodeId = (passed ? node.next : node.otherwise) ?? '';
    return {
      condition: 'courierIdle',
      passed,
      branchChosen,
      targetNodeId,
      explanation: passed
        ? `PASSED: Mock player courierLifecycle is "idle" (no active contract) → follows True (next → ${targetNodeId || 'unlinked'})`
        : `FAILED: Mock player courierLifecycle is "active" (has active contract) → follows False (otherwise → ${targetNodeId || 'unlinked'})`
    };
  }
  const targetNodeId = node.next ?? '';
  return {
    condition: 'always',
    passed: true,
    branchChosen: 'next',
    targetNodeId,
    explanation: `PASSED: Condition "always" always evaluates to True → follows True (next → ${targetNodeId || 'unlinked'})`
  };
}

export function simulateAllowlistedAction(
  node: Node,
  profile: TestPlayerProfile,
  catalog?: {
    routes?: Array<{id: string; label: string}>;
    permits?: Array<{id: string; label: string}>;
  } | null
): SimulatedActionOutcome {
  const action = node.action ?? 'contracts';
  const argument = node.argument;
  const routeLabel =
    catalog?.routes?.find(r => r.id === argument)?.label ?? argument ?? 'unspecified-route';
  const permitLabel =
    catalog?.permits?.find(p => p.id === argument)?.label ?? argument ?? 'unspecified-permit';

  if (action === 'contracts') {
    return {
      action,
      simulated: true,
      mutationPerformed: false,
      requiresLiveRuntimeVerification: true,
      status: 'simulated-ok',
      summary: `[SIMULATED — NO GAMEPLAY MUTATION] Read-only contract board summary (${profile.courierLifecycle === 'idle' ? 'player is idle and can browse routes' : 'player already has an active contract'}).`,
      verificationNote: 'requires live runtime verification for live server contract availability and cooldown state.'
    };
  }
  if (action === 'rank') {
    return {
      action,
      simulated: true,
      mutationPerformed: false,
      requiresLiveRuntimeVerification: true,
      status: 'simulated-ok',
      summary: `[SIMULATED — NO GAMEPLAY MUTATION] Read-only Courier rank check: ${profile.courierRankLabel} (${profile.courierRankEligible ? 'eligible' : 'ineligible'}).`,
      verificationNote: 'requires live runtime verification for authoritative character XP and guild standing.'
    };
  }
  if (action === 'permits') {
    const owned = profile.ownedPermits.length ? profile.ownedPermits.join(', ') : 'none';
    return {
      action,
      simulated: true,
      mutationPerformed: false,
      requiresLiveRuntimeVerification: true,
      status: 'simulated-ok',
      summary: `[SIMULATED — NO GAMEPLAY MUTATION] Read-only permit status inspection (owned: ${owned}; wallet: ${profile.walletGold}g).`,
      verificationNote: 'requires live runtime verification for live character inventory and permit ledger.'
    };
  }
  if (action === 'accept') {
    const blocked = profile.courierLifecycle !== 'idle' || !profile.courierRankEligible || !argument;
    const reason = !argument
      ? 'missing route argument'
      : profile.courierLifecycle !== 'idle'
        ? 'mock player already has an active courier contract'
        : !profile.courierRankEligible
          ? `mock player rank (${profile.courierRankLabel}) is marked ineligible`
          : 'eligible';
    return {
      action,
      argument,
      simulated: true,
      mutationPerformed: false,
      requiresLiveRuntimeVerification: true,
      status: blocked ? 'simulated-blocked' : 'simulated-ok',
      summary: blocked
        ? `[SIMULATED — NO GAMEPLAY MUTATION] Contract acceptance "${routeLabel}" would be rejected (${reason}). Zero contracts or economy records changed.`
        : `[SIMULATED — NO GAMEPLAY MUTATION] Would request Courier contract "${routeLabel}". Zero contracts or economy records changed.`,
      verificationNote: 'requires live runtime verification for server route locks, anti-replay checks, and active session state.'
    };
  }
  // buyPermit
  const alreadyOwned = !!argument && profile.ownedPermits.includes(argument);
  const permitCost = profile.customPermitCostGold ?? 100;
  const insufficientGold = profile.walletGold < permitCost;
  const blocked = !argument || alreadyOwned || insufficientGold;
  const reason = !argument
    ? 'missing permit argument'
    : alreadyOwned
      ? `permit "${argument}" is already owned in mock profile`
      : insufficientGold
        ? `wallet (${profile.walletGold}g) is below simulated permit cost (${permitCost}g)`
        : 'eligible';
  return {
    action: 'buyPermit',
    argument,
    simulated: true,
    mutationPerformed: false,
    requiresLiveRuntimeVerification: true,
    status: blocked ? 'simulated-blocked' : 'simulated-ok',
    summary: blocked
      ? `[SIMULATED — NO GAMEPLAY MUTATION] Permit purchase "${permitLabel}" would be declined (${reason}). Zero gold deducted.`
      : `[SIMULATED — NO GAMEPLAY MUTATION] Would purchase permit "${permitLabel}" (mock wallet ${profile.walletGold}g ≥ ${permitCost}g). Zero gold deducted.`,
    verificationNote: 'requires live runtime verification for authoritative permit pricing and economy journal commit.'
  };
}

function computeExpectedNext(node: Node | undefined, profile: TestPlayerProfile): string | null {
  if (!node) return null;
  if (node.type === 'end' || node.type === 'choices') return null;
  if (node.type === 'condition') {
    const evalDetail = evaluateSimulatedCondition(node, profile);
    return evalDetail.targetNodeId || null;
  }
  return node.next || null;
}

export function createDebuggerSession(
  graph: Graph,
  canvas: Canvas,
  profile: TestPlayerProfile = PRESET_PLAYER_PROFILES[0]!,
  breakpoints: readonly string[] = []
): DebuggerSession {
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]));
  const entryNode = nodesById.get(graph.entry);
  if (!entryNode) {
    return {
      status: 'error',
      profile: structuredClone(profile),
      breakpoints: [...breakpoints],
      currentNodeId: null,
      activeEdgeId: null,
      expectedNextNodeId: null,
      visitedNodeIds: [],
      visitedEdgeIds: [],
      choiceHistory: [],
      steps: [],
      availableChoices: [],
      error: `Entry node "${graph.entry}" does not exist in this graph.`,
      elapsedMs: 0,
      mutationCount: 0
    };
  }
  const expectedNext = computeExpectedNext(entryNode, profile);
  const hitBreakpoint = breakpoints.includes(entryNode.id);
  return {
    status: hitBreakpoint ? 'breakpoint' : 'paused',
    profile: structuredClone(profile),
    breakpoints: [...breakpoints],
    currentNodeId: entryNode.id,
    activeEdgeId: null,
    expectedNextNodeId: expectedNext,
    visitedNodeIds: [entryNode.id],
    visitedEdgeIds: [],
    choiceHistory: [],
    steps: [
      {
        stepIndex: 0,
        nodeId: entryNode.id,
        nodeType: entryNode.type,
        incomingEdgeId: null,
        outgoingEdgeId: expectedNext
          ? findEdgeBetween(canvas, entryNode.id, expectedNext, 'next')
          : null,
        expectedNextNodeId: expectedNext
      }
    ],
    availableChoices: [],
    error: null,
    elapsedMs: 0,
    mutationCount: 0
  };
}

export function stepDebuggerSession(
  session: DebuggerSession,
  graph: Graph,
  canvas: Canvas,
  catalog?: {
    routes?: Array<{id: string; label: string}>;
    permits?: Array<{id: string; label: string}>;
  } | null,
  selectedChoiceId?: string
): DebuggerSession {
  const startedAt = performance.now();
  const nextSession: DebuggerSession = {
    ...session,
    profile: structuredClone(session.profile),
    breakpoints: [...session.breakpoints],
    visitedNodeIds: [...session.visitedNodeIds],
    visitedEdgeIds: [...session.visitedEdgeIds],
    choiceHistory: [...session.choiceHistory],
    steps: [...session.steps],
    availableChoices: [...session.availableChoices],
    mutationCount: 0
  };

  if (nextSession.status === 'completed' || nextSession.status === 'error') {
    return nextSession;
  }
  if (nextSession.steps.length >= MAX_DEBUGGER_STEPS) {
    nextSession.status = 'error';
    nextSession.error = `Simulation step limit (${MAX_DEBUGGER_STEPS} steps) exceeded — possible dialogue cycle.`;
    return nextSession;
  }

  const nodesById = new Map(graph.nodes.map(n => [n.id, n]));
  const currentId = nextSession.currentNodeId;
  if (!currentId || !nodesById.has(currentId)) {
    nextSession.status = 'error';
    nextSession.error = `Current node "${currentId ?? ''}" is missing from the graph.`;
    return nextSession;
  }

  const currentNode = nodesById.get(currentId)!;
  const currentStepIdx = nextSession.steps.length - 1;
  const currentRecord = {...nextSession.steps[currentStepIdx]!};

  let targetId = '';
  let sourceHandle = 'next';

  if (currentNode.type === 'end') {
    nextSession.status = 'completed';
    nextSession.expectedNextNodeId = null;
    nextSession.availableChoices = [];
    nextSession.elapsedMs += Math.max(0, performance.now() - startedAt);
    return nextSession;
  }

  if (currentNode.type === 'choices') {
    const validChoices = (currentNode.choices ?? []).filter(c => c.id && c.text.trim());
    if (!validChoices.length) {
      nextSession.status = 'error';
      nextSession.error = `Choices node "${currentNode.id}" has no valid player choices configured.`;
      currentRecord.error = nextSession.error;
      nextSession.steps[currentStepIdx] = currentRecord;
      return nextSession;
    }
    if (!selectedChoiceId) {
      nextSession.status = 'awaiting-choice';
      nextSession.availableChoices = validChoices.map(c => ({
        id: c.id,
        text: c.text,
        next: c.next
      }));
      nextSession.elapsedMs += Math.max(0, performance.now() - startedAt);
      return nextSession;
    }
    const chosen = validChoices.find(c => c.id === selectedChoiceId);
    if (!chosen) {
      nextSession.status = 'error';
      nextSession.error = `Selected choice "${selectedChoiceId}" does not exist on node "${currentNode.id}".`;
      currentRecord.error = nextSession.error;
      nextSession.steps[currentStepIdx] = currentRecord;
      return nextSession;
    }
    targetId = chosen.next;
    sourceHandle = `choice:${chosen.id}`;
    currentRecord.chosenChoiceId = chosen.id;
    currentRecord.chosenChoiceText = chosen.text;
    nextSession.choiceHistory.push(chosen.id);
    nextSession.availableChoices = [];
  } else if (currentNode.type === 'condition') {
    const evalDetail = evaluateSimulatedCondition(currentNode, nextSession.profile);
    currentRecord.conditionEval = evalDetail;
    targetId = evalDetail.targetNodeId;
    sourceHandle = evalDetail.branchChosen;
  } else if (currentNode.type === 'action') {
    const outcome = simulateAllowlistedAction(currentNode, nextSession.profile, catalog);
    currentRecord.actionOutcome = outcome;
    currentRecord.dialogueText = outcome.summary;
    targetId = currentNode.next ?? '';
    sourceHandle = 'next';
  } else if (currentNode.type === 'npc') {
    currentRecord.dialogueText = currentNode.text ?? '';
    targetId = currentNode.next ?? '';
    sourceHandle = 'next';
  } else {
    // entry
    targetId = currentNode.next ?? '';
    sourceHandle = 'next';
  }

  if (!targetId) {
    nextSession.status = 'error';
    nextSession.error = `Invalid transition: node "${currentNode.id}" (${currentNode.type}) has an unlinked output on handle "${sourceHandle}".`;
    currentRecord.error = nextSession.error;
    nextSession.steps[currentStepIdx] = currentRecord;
    return nextSession;
  }

  const targetNode = nodesById.get(targetId);
  if (!targetNode) {
    nextSession.status = 'error';
    nextSession.error = `Invalid transition: node "${currentNode.id}" points to missing target node "${targetId}".`;
    currentRecord.error = nextSession.error;
    nextSession.steps[currentStepIdx] = currentRecord;
    return nextSession;
  }

  const traversedEdgeId = findEdgeBetween(canvas, currentNode.id, targetId, sourceHandle);
  currentRecord.outgoingEdgeId = traversedEdgeId;
  currentRecord.expectedNextNodeId = targetId;
  nextSession.steps[currentStepIdx] = currentRecord;

  // Detect non-interactive loop (revisiting the same node with the exact same choiceHistory length)
  const previousSameState = nextSession.steps
    .slice(0, -1)
    .some(
      s =>
        s.nodeId === targetId &&
        nextSession.steps
          .slice(nextSession.steps.indexOf(s), nextSession.steps.length)
          .every(inter => !inter.chosenChoiceId)
    );
  if (previousSameState) {
    nextSession.status = 'error';
    nextSession.activeEdgeId = traversedEdgeId;
    nextSession.currentNodeId = targetId;
    nextSession.error = `Infinite cycle detected: transition ${currentNode.id} → ${targetId} loops without player choice or exit.`;
    return nextSession;
  }

  if (traversedEdgeId && !nextSession.visitedEdgeIds.includes(traversedEdgeId)) {
    nextSession.visitedEdgeIds.push(traversedEdgeId);
  }
  if (!nextSession.visitedNodeIds.includes(targetId)) {
    nextSession.visitedNodeIds.push(targetId);
  }

  const nextExpected = computeExpectedNext(targetNode, nextSession.profile);
  const nextStepRecord: DebuggerStepRecord = {
    stepIndex: nextSession.steps.length,
    nodeId: targetNode.id,
    nodeType: targetNode.type,
    incomingEdgeId: traversedEdgeId,
    outgoingEdgeId: nextExpected
      ? findEdgeBetween(
          canvas,
          targetNode.id,
          nextExpected,
          targetNode.type === 'condition'
            ? evaluateSimulatedCondition(targetNode, nextSession.profile).branchChosen
            : 'next'
        )
      : null,
    expectedNextNodeId: nextExpected,
    ...(targetNode.type === 'npc' ? {dialogueText: targetNode.text ?? ''} : {}),
    ...(targetNode.type === 'condition'
      ? {conditionEval: evaluateSimulatedCondition(targetNode, nextSession.profile)}
      : {}),
    ...(targetNode.type === 'action'
      ? {
          actionOutcome: simulateAllowlistedAction(targetNode, nextSession.profile, catalog),
          dialogueText: simulateAllowlistedAction(targetNode, nextSession.profile, catalog).summary
        }
      : {})
  };

  nextSession.steps.push(nextStepRecord);
  nextSession.currentNodeId = targetNode.id;
  nextSession.activeEdgeId = traversedEdgeId;
  nextSession.expectedNextNodeId = nextExpected;

  if (targetNode.type === 'end') {
    nextSession.status = 'completed';
    nextSession.availableChoices = [];
  } else if (nextSession.breakpoints.includes(targetNode.id)) {
    nextSession.status = 'breakpoint';
    nextSession.availableChoices =
      targetNode.type === 'choices'
        ? (targetNode.choices ?? []).map(c => ({id: c.id, text: c.text, next: c.next}))
        : [];
  } else if (targetNode.type === 'choices') {
    nextSession.status = 'awaiting-choice';
    nextSession.availableChoices = (targetNode.choices ?? []).map(c => ({
      id: c.id,
      text: c.text,
      next: c.next
    }));
  } else {
    nextSession.status = 'paused';
    nextSession.availableChoices = [];
  }

  nextSession.elapsedMs += Math.max(0, performance.now() - startedAt);
  return nextSession;
}

export function continueDebuggerSession(
  session: DebuggerSession,
  graph: Graph,
  canvas: Canvas,
  catalog?: {
    routes?: Array<{id: string; label: string}>;
    permits?: Array<{id: string; label: string}>;
  } | null,
  autoChoices: readonly string[] = []
): DebuggerSession {
  const startedAt = performance.now();
  let current = session;
  let choiceQueue = [...autoChoices];
  let guard = 0;

  while (guard < MAX_DEBUGGER_STEPS) {
    guard++;
    if (performance.now() - startedAt > MAX_DEBUGGER_ELAPSED_MS) {
      return {
        ...current,
        status: 'error',
        error: `Simulation elapsed-time limit (${MAX_DEBUGGER_ELAPSED_MS}ms) exceeded.`
      };
    }
    if (current.status === 'completed' || current.status === 'error') {
      break;
    }
    if (current.status === 'awaiting-choice') {
      const nextChoice = choiceQueue.shift();
      if (!nextChoice) break;
      current = stepDebuggerSession(current, graph, canvas, catalog, nextChoice);
    } else {
      current = stepDebuggerSession(current, graph, canvas, catalog);
    }
    if (current.status === 'breakpoint' || (current.status === 'awaiting-choice' && choiceQueue.length === 0)) {
      break;
    }
  }
  return current;
}

export function compareScenarioPaths(
  graph: Graph,
  canvas: Canvas,
  profiles: readonly TestPlayerProfile[],
  choices: readonly string[] = [],
  catalog?: {
    routes?: Array<{id: string; label: string}>;
    permits?: Array<{id: string; label: string}>;
  } | null
): ScenarioComparisonRow[] {
  return profiles.map(profile => {
    const initial = createDebuggerSession(graph, canvas, profile, []);
    const finished = continueDebuggerSession(initial, graph, canvas, catalog, choices);
    const simulatedActions = finished.steps
      .filter(s => s.actionOutcome)
      .map(
        s =>
          `${s.actionOutcome!.action}${s.actionOutcome!.argument ? `(${s.actionOutcome!.argument})` : ''}:${s.actionOutcome!.status}`
      );
    const conditionBranches = finished.steps
      .filter(s => s.conditionEval)
      .map(
        s =>
          `${s.nodeId}[${s.conditionEval!.condition}=${s.conditionEval!.passed ? 'T' : 'F'}→${s.conditionEval!.targetNodeId}]`
      );
    return {
      profileId: profile.id,
      profileName: profile.name,
      thaiName: profile.thaiName,
      status: finished.status,
      visitedNodeIds: finished.visitedNodeIds,
      visitedEdgeIds: finished.visitedEdgeIds,
      terminalNodeId: finished.currentNodeId,
      simulatedActions,
      conditionBranches,
      error: finished.error
    };
  });
}

// C2.5 Validation Navigator
export function diagnoseGraph(
  graph: Graph,
  canvas: Canvas,
  catalog?: {
    routeIds?: string[];
    permitIds?: string[];
  } | null
): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const routeIds = catalog?.routeIds ?? [];
  const permitIds = catalog?.permitIds ?? [];
  const nodesById = new Map(graph.nodes.map(n => [n.id, n]));

  // 1. Structural draft check
  try {
    validateDraftGraph(graph, routeIds, permitIds);
  } catch (err) {
    diagnostics.push({
      id: 'err-draft-schema',
      severity: 'error',
      code: 'DRAFT_SCHEMA_INVALID',
      title: 'Draft schema error',
      explanation: err instanceof Error ? err.message : String(err),
      recommendation: 'Ensure graph ID, schemaVersion (1), entry ID, and node structures are valid.',
      blockingPublish: true
    });
  }

  // 2. Entry & End node checks
  const entryNodes = graph.nodes.filter(n => n.type === 'entry');
  if (entryNodes.length !== 1 || !nodesById.has(graph.entry)) {
    diagnostics.push({
      id: 'err-entry',
      severity: 'error',
      code: 'ENTRY_INVALID',
      title: 'Missing or duplicate Entry node',
      explanation: `Graph must contain exactly one entry node matching "${graph.entry}" (found ${entryNodes.length}).`,
      recommendation: 'Keep a single Entry node as the conversation starting point.',
      nodeId: entryNodes[0]?.id,
      blockingPublish: true
    });
  }

  const endNodes = graph.nodes.filter(n => n.type === 'end');
  if (!endNodes.length) {
    diagnostics.push({
      id: 'err-no-end',
      severity: 'error',
      code: 'NO_END_NODE',
      title: 'Missing End node',
      explanation: 'Every publishable dialogue graph must include at least one End node to return control to the player.',
      recommendation: 'Add an End node using Space (Quick Palette) or the Node Library and connect terminal branches to it.',
      blockingPublish: true
    });
  }

  // 3. Per-node publish validation
  for (const node of graph.nodes) {
    if (node.type === 'npc' && !node.text?.trim()) {
      diagnostics.push({
        id: `err-npc-empty-${node.id}`,
        severity: 'error',
        code: 'NPC_TEXT_EMPTY',
        title: `Empty NPC dialogue on ${node.id}`,
        explanation: `NPC dialogue node "${node.id}" has no dialogue text.`,
        recommendation: 'Click to select the NPC node and enter dialogue text in the Properties inspector.',
        nodeId: node.id,
        blockingPublish: true
      });
    }
    if (node.type === 'choices') {
      if (!node.choices?.length) {
        diagnostics.push({
          id: `err-choices-empty-${node.id}`,
          severity: 'error',
          code: 'CHOICES_EMPTY',
          title: `No player responses on ${node.id}`,
          explanation: `Player choices node "${node.id}" has 0 choices configured.`,
          recommendation: 'Select the Choices node and click "+ Add choice" to add at least one player option.',
          nodeId: node.id,
          blockingPublish: true
        });
      } else {
        const seenTexts = new Set<string>();
        for (const ch of node.choices) {
          if (!ch.text.trim()) {
            diagnostics.push({
              id: `err-choice-text-${node.id}-${ch.id}`,
              severity: 'error',
              code: 'CHOICE_TEXT_EMPTY',
              title: `Empty choice label on ${node.id}`,
              explanation: `Choice "${ch.id}" in node "${node.id}" has no response text.`,
              recommendation: 'Fill in the player response text for this choice or remove the unused choice.',
              nodeId: node.id,
              blockingPublish: true
            });
          } else {
            const norm = ch.text.trim().toLowerCase();
            if (seenTexts.has(norm)) {
              diagnostics.push({
                id: `warn-choice-dup-${node.id}-${ch.id}`,
                severity: 'warning',
                code: 'DUPLICATE_CHOICE_TEXT',
                title: `Duplicate choice text on ${node.id}`,
                explanation: `Multiple choices in "${node.id}" share the exact label "${ch.text.trim()}".`,
                recommendation: 'Differentiate the player response labels so players can distinguish branches.',
                nodeId: node.id,
                blockingPublish: false
              });
            }
            seenTexts.add(norm);
          }
          if (!ch.next || !nodesById.has(ch.next)) {
            diagnostics.push({
              id: `err-choice-next-${node.id}-${ch.id}`,
              severity: 'error',
              code: 'CHOICE_UNLINKED',
              title: `Unlinked choice "${ch.text || ch.id}" on ${node.id}`,
              explanation: `Choice "${ch.id}" on node "${node.id}" does not connect to a valid target node.`,
              recommendation: 'Drag from the choice handle on the canvas to a target node to complete the connection.',
              nodeId: node.id,
              blockingPublish: true
            });
          }
        }
      }
    } else if (node.type !== 'end') {
      if (!node.next || !nodesById.has(node.next)) {
        diagnostics.push({
          id: `err-next-${node.id}`,
          severity: 'error',
          code: 'NEXT_UNLINKED',
          title: `Unlinked output on ${node.id}`,
          explanation: `Node "${node.id}" (${node.type}) is missing its primary outgoing connection.`,
          recommendation: 'Connect the primary output handle of this node to the next step or an End node.',
          nodeId: node.id,
          blockingPublish: true
        });
      }
    }

    if (node.type === 'condition') {
      if (!node.condition || !ALLOWLIST_CONDITIONS.includes(node.condition)) {
        diagnostics.push({
          id: `err-cond-type-${node.id}`,
          severity: 'error',
          code: 'CONDITION_INVALID',
          title: `Unsupported condition on ${node.id}`,
          explanation: `Condition "${String(node.condition)}" is not in the runtime allowlist.`,
          recommendation: 'Select an allowlisted condition (always or courierIdle) in the Properties inspector.',
          nodeId: node.id,
          blockingPublish: true
        });
      }
      if (!node.otherwise || !nodesById.has(node.otherwise)) {
        diagnostics.push({
          id: `err-cond-otherwise-${node.id}`,
          severity: 'error',
          code: 'CONDITION_OTHERWISE_UNLINKED',
          title: `Unlinked False (otherwise) branch on ${node.id}`,
          explanation: `Condition node "${node.id}" requires both True (next) and False (otherwise) connections.`,
          recommendation: 'Connect the False (otherwise) output handle of this Condition node to a valid target node.',
          nodeId: node.id,
          blockingPublish: true
        });
      } else if (node.next && node.next === node.otherwise) {
        diagnostics.push({
          id: `warn-cond-same-${node.id}`,
          severity: 'warning',
          code: 'CONDITION_REDUNDANT_BRANCHES',
          title: `Both branches of ${node.id} point to ${node.next}`,
          explanation: `Condition node "${node.id}" routes both True and False to the exact same node "${node.next}".`,
          recommendation: 'Connect False (otherwise) to a distinct fallback node, or remove the redundant Condition node.',
          nodeId: node.id,
          blockingPublish: false
        });
      }
    }

    if (node.type === 'action') {
      if (!node.action || !ALLOWLIST_ACTIONS.includes(node.action)) {
        diagnostics.push({
          id: `err-action-type-${node.id}`,
          severity: 'error',
          code: 'ACTION_NOT_ALLOWLISTED',
          title: `Forbidden action on ${node.id}`,
          explanation: `Service action "${String(node.action)}" is not allowlisted by the G2.2 server runtime.`,
          recommendation: 'Choose an allowlisted Courier Guild service in the Properties inspector.',
          nodeId: node.id,
          blockingPublish: true
        });
      } else if (node.action === 'accept' && (!node.argument || (routeIds.length > 0 && !routeIds.includes(node.argument)))) {
        diagnostics.push({
          id: `err-action-route-${node.id}`,
          severity: 'error',
          code: 'ACTION_ROUTE_MISSING',
          title: `Missing or unknown Courier route on ${node.id}`,
          explanation: `Action node "${node.id}" (accept) requires a valid Courier route ID from the catalog.`,
          recommendation: 'Select this Action node and pick a valid Target route in the Properties inspector.',
          nodeId: node.id,
          blockingPublish: true
        });
      } else if (node.action === 'buyPermit' && (!node.argument || (permitIds.length > 0 && !permitIds.includes(node.argument)))) {
        diagnostics.push({
          id: `err-action-permit-${node.id}`,
          severity: 'error',
          code: 'ACTION_PERMIT_MISSING',
          title: `Missing or unknown Guild permit on ${node.id}`,
          explanation: `Action node "${node.id}" (buyPermit) requires a valid Guild permit ID from the catalog.`,
          recommendation: 'Select this Action node and pick a valid Target permit in the Properties inspector.',
          nodeId: node.id,
          blockingPublish: true
        });
      } else {
        diagnostics.push({
          id: `info-action-live-${node.id}`,
          severity: 'info',
          code: 'ACTION_LIVE_VERIFICATION',
          title: `Service action "${node.action}" on ${node.id}`,
          explanation: `In-editor simulation mocks "${node.action}" read-only; live player inventory/economy checks require live runtime verification.`,
          recommendation: 'Use the Visual Debugger with Test Player Profiles to verify branches, then verify in-game on the test server.',
          nodeId: node.id,
          blockingPublish: false
        });
      }
    }
  }

  // 4. Reachability and exit-path analysis
  const reachable = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) {
    const targets = [
      n.next,
      n.otherwise,
      ...(n.choices?.map(c => c.next) ?? [])
    ].filter((t): t is string => !!t && nodesById.has(t));
    adj.set(n.id, targets);
  }
  const queue = nodesById.has(graph.entry) ? [graph.entry] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const nextId of adj.get(id) ?? []) {
      if (!reachable.has(nextId)) queue.push(nextId);
    }
  }

  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      diagnostics.push({
        id: `err-unreachable-${node.id}`,
        severity: 'error',
        code: 'NODE_UNREACHABLE',
        title: `Unreachable node ${node.id}`,
        explanation: `Node "${node.id}" (${node.type}) cannot be reached from the Entry node "${graph.entry}".`,
        recommendation: 'Connect an upstream branch to this node or delete the orphaned node before publishing.',
        nodeId: node.id,
        blockingPublish: true
      });
    }
  }

  // Check if every reachable node can reach at least one 'end' node
  const reverseAdj = new Map<string, string[]>();
  for (const [src, targets] of adj.entries()) {
    for (const dst of targets) {
      const list = reverseAdj.get(dst) ?? [];
      list.push(src);
      reverseAdj.set(dst, list);
    }
  }
  const canExit = new Set<string>();
  const exitQueue = graph.nodes.filter(n => n.type === 'end' && reachable.has(n.id)).map(n => n.id);
  while (exitQueue.length) {
    const id = exitQueue.shift()!;
    if (canExit.has(id)) continue;
    canExit.add(id);
    for (const prevId of reverseAdj.get(id) ?? []) {
      if (!canExit.has(prevId)) exitQueue.push(prevId);
    }
  }

  for (const node of graph.nodes) {
    if (reachable.has(node.id) && !canExit.has(node.id)) {
      diagnostics.push({
        id: `err-no-exit-${node.id}`,
        severity: 'error',
        code: 'NODE_NO_EXIT_PATH',
        title: `Closed loop / no exit from ${node.id}`,
        explanation: `Node "${node.id}" is trapped in a cycle or dead end that can never reach an End node.`,
        recommendation: 'Break the loop by routing at least one choice or condition branch to an End node.',
        nodeId: node.id,
        blockingPublish: true
      });
    }
  }

  // Final authoritative check fallback if validateGraph catches anything else
  if (!diagnostics.some(d => d.blockingPublish)) {
    try {
      validateGraph(graph, routeIds, permitIds);
      diagnostics.push({
        id: 'info-publish-ready',
        severity: 'info',
        code: 'GRAPH_PUBLISH_READY',
        title: 'Graph passes all publish checks',
        explanation: `All ${graph.nodes.length} nodes and ${canvas.edges.length} connections satisfy G2.2 runtime constraints.`,
        recommendation: 'Ready to preview, simulate in the Visual Debugger, or publish.',
        blockingPublish: false
      });
    } catch (err) {
      diagnostics.push({
        id: 'err-validate-fallback',
        severity: 'error',
        code: 'VALIDATION_FAILED',
        title: 'Authoritative graph validation error',
        explanation: err instanceof Error ? err.message : String(err),
        recommendation: 'Resolve the reported validation issue before publishing.',
        blockingPublish: true
      });
    }
  }

  return diagnostics;
}
