import type { Graph } from './graph-model';
import { validateGraph } from './graph-model';
import type { Layout } from './blueprint-store';
import { BlueprintStore } from './blueprint-store';
import { previewDialogue } from './preview';

export interface EditorNpc { id: string; name: string; enabled: boolean; deleted: boolean; }
export interface EditorOption { id: string; label: string; }
type OptionInput = string | EditorOption;
const options = (items: readonly OptionInput[]): EditorOption[] => items.map(item =>
  typeof item === 'string' ? { id: item, label: item } : { id: item.id, label: item.label });
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** Typed graph operations only. Authorization belongs to the HTTP transport. */
export class BlueprintService {
  private readonly routeOptions: EditorOption[];
  private readonly permitOptions: EditorOption[];
  private readonly routeIds: string[];
  private readonly permitIds: string[];
  constructor(private store: BlueprintStore, routes: readonly OptionInput[], permits: readonly OptionInput[], private npcs: () => EditorNpc[]) {
    this.routeOptions = options(routes);
    this.permitOptions = options(permits);
    this.routeIds = this.routeOptions.map(item => item.id);
    this.permitIds = this.permitOptions.map(item => item.id);
  }

  read(operation: string, input: unknown) {
    if (!object(input)) throw Error('Invalid editor request');
    if (operation === 'catalog') {
      if (Object.keys(input).length) throw Error('Invalid catalog fields');
      return {
        graphs: this.store.list(),
        npcs: this.npcs().filter(n => n.enabled && !n.deleted),
        routes: this.routeOptions,
        permits: this.permitOptions,
        routeIds: this.routeIds,
        permitIds: this.permitIds,
        revision: this.store.revision(),
        nodeTypes: ['entry', 'npc', 'choices', 'condition', 'action', 'end'],
        actions: ['contracts', 'rank', 'permits', 'accept', 'buyPermit'],
        conditions: ['always', 'courierIdle']
      };
    }
    if (operation === 'graph') {
      if (Object.keys(input).join(',') !== 'id' || typeof input.id !== 'string' ||
          !/^[a-z][a-z0-9-]{0,63}$/.test(input.id) || ['constructor', 'prototype', '__proto__'].includes(input.id)) {
        throw Error('Invalid graph request');
      }
      const entry = this.store.list().find(g => g.id === input.id);
      if (!entry) throw Error('Unknown graph');
      return {
        draft: this.store.draft(input.id),
        published: entry.version ? this.store.published(input.id) : null,
        history: this.store.history(input.id)
      };
    }
    throw Error('Unknown read operation');
  }

  execute(operation: string, input: unknown, author: string) {
    if (!object(input)) throw Error('Invalid editor request');
    const fields: Record<string, string[]> = {
      draft: ['graph', 'layout', 'revision'], validate: ['graph'], preview: ['graph', 'choices', 'activeCourier'],
      publish: ['id', 'draftRevision', 'version'], rollback: ['id', 'targetVersion', 'version'],
      assign: ['npc', 'id', 'revision']
    };
    if (!Object.hasOwn(fields, operation) || Object.keys(input).sort().join(',') !== fields[operation]!.slice().sort().join(',')) {
      throw Error('Invalid operation fields');
    }
    switch (operation) {
      case 'draft': return this.store.saveDraft(input.graph as Graph, input.layout as Layout, input.revision as number, author);
      case 'validate': return { graph: validateGraph(input.graph, this.routeIds, this.permitIds), valid: true };
      case 'preview': return previewDialogue(input.graph, input.choices, input.activeCourier as boolean, this.routeIds, this.permitIds);
      case 'publish': return this.store.publish(input.id as string, input.draftRevision as number, input.version as number, author);
      case 'rollback': return this.store.rollback(input.id as string, input.targetVersion as number, input.version as number, author);
      case 'assign': {
        const eligible = this.npcs().some(n => n.id === input.npc && n.enabled && !n.deleted);
        if (!eligible) throw Error('NPC is not eligible');
        return { revision: this.store.assign(input.npc as string, input.id as string, input.revision as number, author) };
      }
      default: throw Error('Unsupported editor operation');
    }
  }
}
