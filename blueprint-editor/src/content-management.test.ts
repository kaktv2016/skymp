import {describe, it, expect} from 'vitest';
import {toCanvas} from './mapping';
import {emptyPresentation} from '../../rp-gamemode/src/modules/dialogue/graph-model';
import type {Graph} from '../../rp-gamemode/src/modules/dialogue/graph-model';
import {
  diffGraphVersions,
  buildRecoverySnapshot,
  saveRecoverySnapshotToStorage,
  loadRecoverySnapshotFromStorage,
  clearRecoverySnapshotFromStorage,
  assessRecoveryConflict,
  findReferences,
  addGraphBookmark,
  renameGraphBookmark,
  deleteGraphBookmark,
  EDITOR_SHORTCUTS,
  isEditableInputTarget
} from './content-management';

const v1Graph: Graph = {
  schemaVersion: 1,
  id: 'whiterun-clerk-diff',
  version: 1,
  entry: 'entry',
  nodes: [
    {id: 'entry', type: 'entry', next: 'greet'},
    {id: 'greet', type: 'npc', text: 'สวัสดี v1', next: 'old-node'},
    {id: 'old-node', type: 'action', action: 'contracts', next: 'end'},
    {id: 'end', type: 'end'}
  ]
};

const v2Graph: Graph = {
  schemaVersion: 1,
  id: 'whiterun-clerk-diff',
  version: 2,
  entry: 'entry',
  nodes: [
    {id: 'entry', type: 'entry', next: 'greet'},
    {id: 'greet', type: 'npc', text: 'สวัสดี v2 (แก้ไขบทพูด)', next: 'new-choice'},
    {
      id: 'new-choice',
      type: 'choices',
      choices: [{id: 'c1', text: 'รับงาน', next: 'end'}]
    },
    {id: 'end', type: 'end'}
  ]
};

describe('Milestone C.3 — Content Management & Recovery', () => {
  it('C3.1: diffs saved/published versions by stable IDs, preserves removed node snapshots, and separates presentation changes', () => {
    const diff = diffGraphVersions(
      {
        label: 'Published v1',
        version: 1,
        graph: v1Graph,
        layout: {entry: {x: 0, y: 0}, 'old-node': {x: 400, y: 120}},
        presentation: emptyPresentation()
      },
      {
        label: 'Draft r3',
        revision: 3,
        graph: v2Graph,
        layout: {entry: {x: 80, y: 40}},
        presentation: {
          schemaVersion: 1,
          groups: [
            {
              id: 'group-1',
              title: 'Opening',
              description: 'Note',
              color: 'gold',
              x: 0,
              y: 0,
              width: 320,
              height: 220,
              collapsed: false,
              nodeIds: ['entry']
            }
          ],
          bookmarks: []
        }
      }
    );

    expect(diff.identicalExecutable).toBe(false);
    expect(diff.identicalPresentation).toBe(false);
    expect(diff.addedNodes.map(n => n.nodeId)).toEqual(['new-choice']);
    expect(diff.removedNodes.map(n => n.nodeId)).toEqual(['old-node']);
    // Removed node retains full historical snapshot without modifying target graph
    expect(diff.removedNodes[0]!.historicalNode.action).toBe('contracts');
    expect(diff.removedNodes[0]!.historicalPosition).toEqual({x: 400, y: 120});
    expect(diff.modifiedNodes.map(n => n.nodeId)).toEqual(['greet']);
    expect(diff.modifiedNodes[0]!.changes.map(c => c.field)).toEqual(['text', 'next']);
    expect(diff.presentationDiffs.some(p => p.kind === 'layout' && p.id === 'entry')).toBe(true);
    expect(diff.presentationDiffs.some(p => p.kind === 'group' && p.id === 'group-1')).toBe(true);
  });

  it('C3.2: persists and restores version-aware draft recovery snapshots, detects server conflicts, and blocks auth secrets', () => {
    const memory = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => {
        memory.set(k, v);
      },
      removeItem: (k: string) => {
        memory.delete(k);
      }
    };

    const snap = buildRecoverySnapshot(
      v2Graph,
      {entry: {x: 12, y: 34}},
      emptyPresentation(),
      2,
      1
    );
    expect(saveRecoverySnapshotToStorage(snap, mockStorage)).toBe(true);

    const loaded = loadRecoverySnapshotFromStorage(v2Graph.id, [], [], mockStorage);
    expect(loaded).not.toBeNull();
    expect(loaded!.baseRevision).toBe(2);
    expect(loaded!.graph.nodes).toHaveLength(4);

    // Conflict detection when server has newer revision r5
    const conflict = assessRecoveryConflict(loaded!, 5, 2, v1Graph);
    expect(conflict.hasServerConflict).toBe(true);
    expect(conflict.explanation).toContain('Conflict detected');

    // Secret key rejection
    expect(() =>
      saveRecoverySnapshotToStorage({...snap, csrf: 'secret-token'} as any, mockStorage)
    ).toThrow(/authentication or secret/i);

    clearRecoverySnapshotFromStorage(v2Graph.id, mockStorage);
    expect(loadRecoverySnapshotFromStorage(v2Graph.id, [], [], mockStorage)).toBeNull();
  });

  it('C3.3: finds incoming/outgoing local references and cross-graph usages from indexed entries', () => {
    const canvas = toCanvas(v2Graph);
    const localRefs = findReferences(v2Graph, canvas, {nodeId: 'greet'});
    expect(localRefs.some(r => r.direction === 'incoming' && r.nodeId === 'entry')).toBe(true);
    expect(localRefs.some(r => r.direction === 'outgoing' && r.nodeId === 'new-choice')).toBe(true);

    const actionRefs = findReferences(
      v1Graph,
      toCanvas(v1Graph),
      {action: 'contracts'},
      [
        {
          graphId: 'solitude-clerk',
          source: 'published',
          version: 3,
          assignedNpcs: ['solitude_clerk'],
          nodeId: 'act-contracts',
          nodeType: 'action',
          action: 'contracts',
          argument: null,
          condition: null,
          targets: ['end'],
          choices: []
        }
      ]
    );
    expect(actionRefs.some(r => r.scope === 'local' && r.nodeId === 'old-node')).toBe(true);
    expect(
      actionRefs.some(
        r => r.scope === 'cross-graph' && r.graphId === 'solitude-clerk' && r.nodeId === 'act-contracts'
      )
    ).toBe(true);
  });

  it('C3.4 & C3.5: manages named Graph Bookmarks in presentation metadata and provides shortcut reference', () => {
    let pres = emptyPresentation();
    const added = addGraphBookmark(pres, {
      id: 'bm-entry',
      name: 'Entry Viewpoint',
      nodeId: 'entry',
      viewport: {x: 120.4, y: -45.8, zoom: 1.25}
    });
    pres = added.presentation;
    expect(pres.bookmarks).toHaveLength(1);
    expect(pres.bookmarks[0]).toEqual({
      id: 'bm-entry',
      name: 'Entry Viewpoint',
      nodeId: 'entry',
      viewport: {
        x: 120,
        y: -46,
        zoom: 1.25
      }
    });

    pres = renameGraphBookmark(pres, 'bm-entry', 'Opening Camera');
    expect(pres.bookmarks[0]!.name).toBe('Opening Camera');

    pres = deleteGraphBookmark(pres, 'bm-entry');
    expect(pres.bookmarks).toHaveLength(0);

    expect(EDITOR_SHORTCUTS.length).toBeGreaterThanOrEqual(10);
    expect(isEditableInputTarget({tagName: 'INPUT'} as unknown as EventTarget)).toBe(true);
    expect(isEditableInputTarget({tagName: 'DIV'} as unknown as EventTarget)).toBe(false);
  });
});
