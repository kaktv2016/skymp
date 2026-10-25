import {describe, it, expect} from 'vitest';
import {toCanvas} from './mapping';
import type {Graph} from '../../rp-gamemode/src/modules/dialogue/graph-model';
import {
  PRESET_PLAYER_PROFILES,
  createDebuggerSession,
  stepDebuggerSession,
  continueDebuggerSession,
  compareScenarioPaths,
  diagnoseGraph,
  type TestPlayerProfile
} from './debugger';

const clerkFixture: Graph = {
  schemaVersion: 1,
  id: 'whiterun-clerk-test',
  version: 2,
  entry: 'entry',
  nodes: [
    {id: 'entry', type: 'entry', next: 'greet'},
    {id: 'greet', type: 'npc', text: 'สวัสดีนักเดินทาง', next: 'choices'},
    {
      id: 'choices',
      type: 'choices',
      choices: [
        {id: 'work', text: 'ขอดูงานส่งพัสดุ', next: 'check'},
        {id: 'permit', text: 'ซื้อใบอนุญาต', next: 'buy'},
        {id: 'bye', text: 'ลาก่อน', next: 'end'}
      ]
    },
    {id: 'check', type: 'condition', condition: 'courierIdle', next: 'accept', otherwise: 'busy'},
    {id: 'accept', type: 'action', action: 'accept', argument: 'whiterun_riverwood_ standard', next: 'end'},
    {id: 'busy', type: 'npc', text: 'เจ้ามีงานค้างอยู่', next: 'end'},
    {id: 'buy', type: 'action', action: 'buyPermit', argument: 'permit_whiterun_trade', next: 'end'},
    {id: 'end', type: 'end'}
  ]
};

const catalog = {
  routeIds: ['whiterun_riverwood_ standard'],
  permitIds: ['permit_whiterun_trade'],
  routes: [{id: 'whiterun_riverwood_ standard', label: 'Whiterun → Riverwood'}],
  permits: [{id: 'permit_whiterun_trade', label: 'Whiterun Trade Permit'}]
};

describe('Milestone C.2 — Visual Dialogue Debugger & Validation Navigator', () => {
  it('C2.1 & C2.2: steps through dialogue, evaluates conditions, and mocks actions with zero mutations', () => {
    const canvas = toCanvas(clerkFixture);
    const idleProfile = structuredClone(PRESET_PLAYER_PROFILES[0]!);
    let session = createDebuggerSession(clerkFixture, canvas, idleProfile);

    expect(session.status).toBe('paused');
    expect(session.currentNodeId).toBe('entry');
    expect(session.expectedNextNodeId).toBe('greet');
    expect(session.mutationCount).toBe(0);

    // Step 1: entry -> greet
    session = stepDebuggerSession(session, clerkFixture, canvas, catalog);
    expect(session.currentNodeId).toBe('greet');
    expect(session.activeEdgeId).toBe('entry:next');

    // Step 2: greet -> choices (awaiting-choice)
    session = stepDebuggerSession(session, clerkFixture, canvas, catalog);
    expect(session.currentNodeId).toBe('choices');
    expect(session.status).toBe('awaiting-choice');
    expect(session.availableChoices.map(c => c.id)).toEqual(['work', 'permit', 'bye']);

    // Step 3: choose 'work' -> check (condition courierIdle)
    session = stepDebuggerSession(session, clerkFixture, canvas, catalog, 'work');
    expect(session.currentNodeId).toBe('check');
    expect(session.choiceHistory).toEqual(['work']);
    const checkStep = session.steps.at(-1)!;
    expect(checkStep.conditionEval?.passed).toBe(true);
    expect(checkStep.conditionEval?.branchChosen).toBe('next');
    expect(checkStep.conditionEval?.explanation).toContain('PASSED');

    // Step 4: check -> accept (action simulated read-only)
    session = stepDebuggerSession(session, clerkFixture, canvas, catalog);
    expect(session.currentNodeId).toBe('accept');
    const acceptStep = session.steps.at(-1)!;
    expect(acceptStep.actionOutcome?.simulated).toBe(true);
    expect(acceptStep.actionOutcome?.mutationPerformed).toBe(false);
    expect(acceptStep.actionOutcome?.requiresLiveRuntimeVerification).toBe(true);
    expect(acceptStep.actionOutcome?.summary).toContain('[SIMULATED — NO GAMEPLAY MUTATION]');

    // Step 5: accept -> end
    session = stepDebuggerSession(session, clerkFixture, canvas, catalog);
    expect(session.currentNodeId).toBe('end');
    expect(session.status).toBe('completed');
    expect(session.visitedNodeIds).toEqual(['entry', 'greet', 'choices', 'check', 'accept', 'end']);
    expect(session.mutationCount).toBe(0);
    // Input profile was never mutated
    expect(idleProfile).toEqual(PRESET_PLAYER_PROFILES[0]);
  });

  it('C2.3: compares Test Player Profiles across different scenario branches without touching live state', () => {
    const canvas = toCanvas(clerkFixture);
    const rows = compareScenarioPaths(
      clerkFixture,
      canvas,
      PRESET_PLAYER_PROFILES.slice(0, 3),
      ['work'],
      catalog
    );
    expect(rows).toHaveLength(3);

    // Profile 0: Idle Courier -> takes True branch to 'accept'
    expect(rows[0]!.visitedNodeIds).toContain('accept');
    expect(rows[0]!.visitedNodeIds).not.toContain('busy');
    expect(rows[0]!.simulatedActions[0]).toContain('accept(whiterun_riverwood_ standard):simulated-ok');

    // Profile 1: Active Courier Contract -> takes False branch to 'busy'
    expect(rows[1]!.visitedNodeIds).toContain('busy');
    expect(rows[1]!.visitedNodeIds).not.toContain('accept');
    expect(rows[1]!.conditionBranches[0]).toContain('check[courierIdle=F→busy]');

    // Profile 2: Ineligible Novice -> reaches 'accept' but simulated action reports blocked
    expect(rows[2]!.visitedNodeIds).toContain('accept');
    expect(rows[2]!.simulatedActions[0]).toContain('simulated-blocked');
  });

  it('C2.4: pauses on node breakpoints and terminates non-interactive cycles safely', () => {
    const canvas = toCanvas(clerkFixture);
    const initial = createDebuggerSession(clerkFixture, canvas, PRESET_PLAYER_PROFILES[0]!, ['check']);
    const pausedAtBp = continueDebuggerSession(initial, clerkFixture, canvas, catalog, ['work']);
    expect(pausedAtBp.status).toBe('breakpoint');
    expect(pausedAtBp.currentNodeId).toBe('check');

    // Cyclic malformed draft
    const cyclicGraph: Graph = {
      schemaVersion: 1,
      id: 'cyclic-draft',
      version: 1,
      entry: 'entry',
      nodes: [
        {id: 'entry', type: 'entry', next: 'a'},
        {id: 'a', type: 'npc', text: 'Loop A', next: 'b'},
        {id: 'b', type: 'npc', text: 'Loop B', next: 'a'},
        {id: 'end', type: 'end'}
      ]
    };
    const cyclicCanvas = toCanvas(cyclicGraph);
    const cyclicStart = createDebuggerSession(cyclicGraph, cyclicCanvas);
    const cyclicEnd = continueDebuggerSession(cyclicStart, cyclicGraph, cyclicCanvas);
    expect(cyclicEnd.status).toBe('error');
    expect(cyclicEnd.error).toContain('Infinite cycle detected');
  });

  it('C2.5: categorizes blocking errors, warnings, and informational notices in Validation Navigator', () => {
    const validCanvas = toCanvas(clerkFixture);
    const cleanDiags = diagnoseGraph(clerkFixture, validCanvas, catalog);
    expect(cleanDiags.filter(d => d.blockingPublish)).toHaveLength(0);
    expect(cleanDiags.some(d => d.code === 'GRAPH_PUBLISH_READY')).toBe(true);
    expect(cleanDiags.some(d => d.code === 'ACTION_LIVE_VERIFICATION')).toBe(true);

    // Introduce blocking errors & warnings
    const brokenGraph: Graph = {
      ...clerkFixture,
      nodes: [
        ...clerkFixture.nodes.map(n =>
          n.id === 'greet'
            ? {...n, text: '   '}
            : n.id === 'check'
              ? {...n, otherwise: 'accept'} // redundant branches warning
              : n
        ),
        {id: 'orphan', type: 'npc', text: 'Orphaned', next: 'end'}
      ]
    };
    const brokenDiags = diagnoseGraph(brokenGraph, toCanvas(brokenGraph), catalog);
    expect(brokenDiags.some(d => d.code === 'NPC_TEXT_EMPTY' && d.nodeId === 'greet' && d.blockingPublish)).toBe(true);
    expect(brokenDiags.some(d => d.code === 'NODE_UNREACHABLE' && d.nodeId === 'orphan' && d.blockingPublish)).toBe(true);
    expect(brokenDiags.some(d => d.code === 'CONDITION_REDUNDANT_BRANCHES' && d.nodeId === 'check' && !d.blockingPublish)).toBe(true);
  });
});
