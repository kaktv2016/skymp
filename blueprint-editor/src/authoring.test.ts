import {describe, it, expect} from 'vitest';
import {
  buildQuickPaletteItems,
  filterQuickPalette,
  createQuickNodeOnCanvas,
  planEdgeInsertion,
  applyEdgeInsertion,
  copySelection,
  pasteClipboard,
  duplicateSelection,
  cutSelection,
  moveSelectedNodes,
  deleteSelectedNodes,
  nodesInRectangle,
  createVisualGroup,
  updateVisualGroup,
  moveVisualGroupWithContents,
  deleteVisualGroup,
  emptyPresentation,
  validatePresentation,
  GRAPH_TEMPLATES,
  buildTemplateBlueprint,
  insertGraphTemplate,
  type CatalogOptions
} from './authoring';
import {toCanvas, fromCanvas} from './mapping';
import {validateGraph, validateDraftGraph, type Graph} from '../../rp-gamemode/src/modules/dialogue/graph-model';

const catalog: CatalogOptions = {
  routes: [{id: 'route-whiterun', label: 'เส้นทาง Whiterun'}],
  permits: [{id: 'regional', label: 'ใบอนุญาตภูมิภาค'}],
  routeIds: ['route-whiterun'],
  permitIds: ['regional'],
  actions: ['contracts', 'rank', 'permits', 'accept', 'buyPermit'],
  conditions: ['always', 'courierIdle']
};

const baseGraph: Graph = {
  schemaVersion: 1,
  id: 'courier-clerk',
  version: 1,
  entry: 'entry',
  nodes: [
    {id: 'entry', type: 'entry', next: 'welcome'},
    {id: 'welcome', type: 'npc', text: 'ยินดีต้อนรับสู่กิลด์', next: 'menu'},
    {
      id: 'menu',
      type: 'choices',
      choices: [
        {id: 'contracts', text: 'ดูสัญญาส่งของ', next: 'act-contracts'},
        {id: 'exit', text: 'ออก', next: 'end'}
      ]
    },
    {id: 'act-contracts', type: 'action', action: 'contracts', next: 'menu'},
    {id: 'end', type: 'end'}
  ]
};

describe('C.1 Authoring Productivity — Pure Engine', () => {
  it('C1.1 builds runtime-supported palette items, supports Thai search, and connects handle drops atomically', () => {
    const items = buildQuickPaletteItems(catalog, true, null);
    // Entry already exists in graph, so entry is not offered
    expect(items.some(i => i.nodeType === 'entry')).toBe(false);
    expect(items.some(i => i.kind === 'group')).toBe(true);

    // Thai search finds specific service and condition items
    const thaiMatches = filterQuickPalette(items, 'ใบอนุญาตภูมิภาค');
    expect(thaiMatches.some(i => i.action === 'buyPermit' && i.argument === 'regional')).toBe(true);

    const idleMatches = filterQuickPalette(items, 'ไม่มีงาน');
    expect(idleMatches.some(i => i.nodeType === 'condition' && i.condition === 'courierIdle')).toBe(true);

    // Dragging from an output handle filters out entry and non-executable group items
    const handleItems = buildQuickPaletteItems(catalog, false, {source: 'welcome', sourceHandle: 'next'});
    expect(handleItems.some(i => i.nodeType === 'entry')).toBe(false);
    expect(handleItems.some(i => i.kind === 'group')).toBe(false);

    // Creating a node from an output handle drop creates and connects in one step
    const canvas = toCanvas(baseGraph);
    const npcItem = handleItems.find(i => i.nodeType === 'npc')!;
    const created = createQuickNodeOnCanvas(
      canvas,
      npcItem,
      {x: 520, y: 240},
      catalog,
      {source: 'welcome', sourceHandle: 'next'},
      () => 'new01'
    );
    expect(created.nodeId).toBe('npc-new01');
    expect(created.canvas.edges.find(e => e.source === 'welcome' && e.sourceHandle === 'next')?.target).toBe('npc-new01');
    const draft = fromCanvas(baseGraph, created.canvas);
    expect(() => validateDraftGraph(draft, catalog.routeIds, catalog.permitIds)).not.toThrow();
  });

  it('C1.2 validates edge insertion compatibility, rejects entry/end, requires branch disambiguation, and preserves choice handle semantics', () => {
    const canvas = toCanvas(baseGraph);

    // Entry and End are rejected with clear reasons
    const entryPlan = planEdgeInsertion(canvas, 'menu:choice:contracts', 'entry', {catalog});
    expect(entryPlan.valid).toBe(false);
    expect(entryPlan.reason).toMatch(/Entry/);

    const endPlan = planEdgeInsertion(canvas, 'menu:choice:contracts', 'end', {catalog});
    expect(endPlan.valid).toBe(false);
    expect(endPlan.reason).toMatch(/End/);

    // Condition without explicit branch is marked ambiguous
    const ambigCond = planEdgeInsertion(canvas, 'menu:choice:contracts', 'condition', {
      condition: 'courierIdle',
      catalog
    });
    expect(ambigCond.valid).toBe(false);
    expect(ambigCond.ambiguous).toBe(true);
    expect(ambigCond.availableOutputs).toHaveLength(2);

    // Condition with explicit branch succeeds and preserves source choice identity
    const validCond = planEdgeInsertion(canvas, 'menu:choice:contracts', 'condition', {
      condition: 'courierIdle',
      outgoingHandle: 'next',
      catalog,
      randomSuffix: () => 'cond01'
    });
    expect(validCond.valid).toBe(true);
    expect(validCond.ambiguous).toBe(false);

    const updated = applyEdgeInsertion(canvas, validCond);
    expect(updated.edges.some(e => e.id === 'menu:choice:contracts' && e.target === 'condition-cond01')).toBe(true);
    expect(updated.edges.some(e => e.id === 'condition-cond01:next' && e.target === 'act-contracts')).toBe(true);
    const updatedMenu = updated.nodes.find(n => n.id === 'menu')!.data.runtime;
    expect(updatedMenu.choices?.find(c => c.id === 'contracts')?.next).toBe('condition-cond01');
  });

  it('C1.3 copies only internal edges, remaps node and choice IDs, strips external links, and preserves Unicode', () => {
    const canvas = toCanvas(baseGraph);
    // Select welcome + menu + act-contracts (note: end is NOT selected, entry is ignored)
    const clip = copySelection(canvas, ['entry', 'welcome', 'menu', 'act-contracts']);
    expect(clip.nodes.map(n => n.runtime.id)).toEqual(['welcome', 'menu', 'act-contracts']);
    // Edge menu -> end is external because 'end' was not copied; menu -> act-contracts is internal
    expect(clip.edges.some(e => e.target === 'end')).toBe(false);
    expect(clip.edges.some(e => e.source === 'menu' && e.target === 'act-contracts')).toBe(true);
    expect(clip.nodes.find(n => n.runtime.id === 'menu')!.runtime.choices?.find(c => c.id === 'exit')?.next).toBe('');

    let seq = 1;
    const pasted = pasteClipboard(clip, canvas, catalog.routeIds, catalog.permitIds, {x: 80, y: 80}, () => `p${seq++}`);
    expect(pasted.pastedIds).toHaveLength(3);
    // No ID collisions or stale references to original IDs
    const origIds = new Set(baseGraph.nodes.map(n => n.id));
    for (const id of pasted.pastedIds) {
      expect(origIds.has(id)).toBe(false);
      const node = pasted.canvas.nodes.find(n => n.id === id)!.data.runtime;
      if (node.type === 'choices') {
        for (const c of node.choices ?? []) {
          expect(['contracts', 'exit'].includes(c.id)).toBe(false);
          if (c.next) expect(pasted.pastedIds.includes(c.next)).toBe(true);
        }
      } else if (node.next) {
        expect(pasted.pastedIds.includes(node.next)).toBe(true);
      }
    }

    // Unicode preserved
    const pastedWelcome = pasted.canvas.nodes.find(n => n.id === pasted.pastedIds[0])!.data.runtime;
    expect(pastedWelcome.text).toBe('ยินดีต้อนรับสู่กิลด์');

    // Duplicate selection works atomically
    const dup = duplicateSelection(canvas, ['welcome'], catalog.routeIds, catalog.permitIds, {x: 40, y: 40}, () => 'dup01');
    expect(dup.duplicatedIds).toEqual(['npc-dup01']);

    // Cut selection removes non-entry nodes and keeps entry intact
    const cut = cutSelection(canvas, emptyPresentation(), ['entry', 'welcome'], 'entry');
    expect(cut.canvas.nodes.some(n => n.id === 'entry')).toBe(true);
    expect(cut.canvas.nodes.some(n => n.id === 'welcome')).toBe(false);

    // Rectangle selection finds nodes inside bounds
    const inRect = nodesInRectangle(canvas, {x1: -2000, y1: -2000, x2: 5000, y2: 5000});
    expect(inRect.length).toBe(canvas.nodes.length);
  });

  it('C1.4 manages visual groups and comments separately from executable graph schema and moves grouped nodes together', () => {
    const canvas = toCanvas(baseGraph);
    const {presentation: p1, group} = createVisualGroup(
      emptyPresentation(),
      canvas,
      ['welcome', 'menu'],
      {title: 'ส่วนต้อนรับผู้เล่น', description: 'คอมเมนต์ภาษาไทย', color: 'teal', randomSuffix: () => 'grp01'}
    );
    expect(group.id).toBe('group-grp01');
    expect(group.nodeIds).toEqual(['welcome', 'menu']);

    const p2 = updateVisualGroup(p1, group.id, {collapsed: true, width: 420, height: 260});
    expect(p2.groups[0]!.collapsed).toBe(true);
    expect(p2.groups[0]!.width).toBe(420);

    const welcomeBefore = canvas.nodes.find(n => n.id === 'welcome')!.position;
    const endBefore = canvas.nodes.find(n => n.id === 'end')!.position;
    const moved = moveVisualGroupWithContents(canvas, p2, group.id, {x: 100, y: 50});
    expect(moved.presentation.groups[0]!.x).toBe(p2.groups[0]!.x + 100);
    expect(moved.canvas.nodes.find(n => n.id === 'welcome')!.position).toEqual({
      x: welcomeBefore.x + 100,
      y: welcomeBefore.y + 50
    });
    expect(moved.canvas.nodes.find(n => n.id === 'end')!.position).toEqual(endBefore);

    // Executable graph is 100% unchanged by group creation, collapse, move, or delete
    expect(fromCanvas(baseGraph, moved.canvas)).toEqual(baseGraph);
    expect(() => validateGraph(fromCanvas(baseGraph, moved.canvas), catalog.routeIds, catalog.permitIds)).not.toThrow();

    const p3 = deleteVisualGroup(moved.presentation, group.id);
    expect(p3.groups).toHaveLength(0);
    expect(() => validatePresentation(p3)).not.toThrow();
  });

  it('C1.5 previews and inserts all 6 graph templates with valid runtime types, real catalog arguments, and fresh IDs', () => {
    const canvas = toCanvas(baseGraph);
    expect(GRAPH_TEMPLATES).toHaveLength(6);

    let counter = 1;
    let currentCanvas = canvas;
    for (const spec of GRAPH_TEMPLATES) {
      const preview = buildTemplateBlueprint(spec.id, {
        routeId: 'route-whiterun',
        permitId: 'regional',
        catalog
      });
      expect(preview.nodes.length).toBeGreaterThanOrEqual(2);
      const res = insertGraphTemplate(currentCanvas, spec.id, {
        routeId: 'route-whiterun',
        permitId: 'regional',
        catalog,
        randomSuffix: () => `t${counter++}`
      });
      expect(res.insertedIds.length).toBe(preview.nodes.length);
      currentCanvas = res.canvas;
    }

    const draft = fromCanvas(baseGraph, currentCanvas);
    expect(() => validateDraftGraph(draft, catalog.routeIds, catalog.permitIds)).not.toThrow();
  });
});
