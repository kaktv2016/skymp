export type Cleanup = () => void | Promise<void>;

export interface ModuleScope {
  defer(cleanup: Cleanup): void;
}

export interface ModuleDefinition {
  id: string;
  dependencies?: readonly string[];
  initialize(scope: ModuleScope): void | Promise<void>;
}

type ModuleState =
  | 'registered'
  | 'initializing'
  | 'running'
  | 'failed'
  | 'stopped';

interface ModuleEntry {
  definition: ModuleDefinition;
  state: ModuleState;
  cleanups: Cleanup[];
}

function validateId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !id.trim() || id !== id.trim()) {
    throw new TypeError('Module IDs must be nonempty strings without padding');
  }
}

/** A one-shot lifecycle; shutdown waits for boot before releasing resources. */
export class ModuleRegistry {
  private readonly entries = new Map<string, ModuleEntry>();
  private readonly started: ModuleEntry[] = [];
  private bootTask?: Promise<void>;
  private shutdownTask?: Promise<void>;

  register(definition: ModuleDefinition): void {
    if (this.bootTask || this.shutdownTask) {
      throw new Error('Cannot register modules after boot or shutdown starts');
    }
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('Module definition must be an object');
    }
    validateId(definition.id);
    if (typeof definition.initialize !== 'function') {
      throw new TypeError('Module initialize must be a function');
    }
    if (
      definition.dependencies !== undefined &&
      !Array.isArray(definition.dependencies)
    ) {
      throw new TypeError('Module dependencies must be an array');
    }
    const dependencies = [...(definition.dependencies ?? [])];
    dependencies.forEach(validateId);
    if (this.entries.has(definition.id)) {
      throw new Error(`Duplicate module: ${definition.id}`);
    }
    this.entries.set(definition.id, {
      definition: {
        id: definition.id,
        dependencies,
        initialize: definition.initialize,
      },
      state: 'registered',
      cleanups: [],
    });
  }

  boot(): Promise<void> {
    if (this.bootTask || this.shutdownTask) {
      return Promise.reject(new Error('Module registry cannot boot twice'));
    }
    // Reserve the lifecycle before an initializer can call another method.
    this.bootTask = Promise.resolve().then(() => this.initializeAll());
    return this.bootTask;
  }

  shutdown(): Promise<void> {
    if (!this.shutdownTask) {
      this.shutdownTask = Promise.resolve().then(async () => {
        if (this.bootTask) {
          // Boot owns rollback on failure; shutdown must still await it.
          try {
            await this.bootTask;
          } catch {
            // The boot caller receives initialization and rollback errors.
          }
        }
        const errors = await this.cleanupStarted();
        if (errors.length) {
          throw new AggregateError(errors, 'Module shutdown cleanup failed');
        }
      });
    }
    return this.shutdownTask;
  }

  state(id: string): ModuleState {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Unknown module: ${id}`);
    }
    return entry.state;
  }

  activeIds(): readonly string[] {
    return this.started
      .filter((entry) => entry.state === 'running')
      .map((entry) => entry.definition.id);
  }

  private dependencyOrder(): ModuleEntry[] {
    const order: ModuleEntry[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (entry: ModuleEntry): void => {
      const { id, dependencies } = entry.definition;
      if (visiting.has(id)) {
        throw new Error(`Module dependency cycle at ${id}`);
      }
      if (visited.has(id)) {
        return;
      }
      visiting.add(id);
      for (const dependencyId of dependencies ?? []) {
        const dependency = this.entries.get(dependencyId);
        if (!dependency) {
          throw new Error(`Missing dependency ${dependencyId} for module ${id}`);
        }
        visit(dependency);
      }
      visiting.delete(id);
      visited.add(id);
      order.push(entry);
    };
    for (const entry of this.entries.values()) {
      visit(entry);
    }
    return order;
  }

  private async initializeAll(): Promise<void> {
    // Resolve the entire graph before any module acquires resources.
    const order = this.dependencyOrder();
    try {
      for (const entry of order) {
        entry.state = 'initializing';
        this.started.push(entry);
        let scopeOpen = true;
        const scope: ModuleScope = {
          defer: (cleanup) => {
            if (!scopeOpen) {
              throw new Error('Module scope is closed after initialization');
            }
            if (typeof cleanup !== 'function') {
              throw new TypeError('Deferred cleanup must be a function');
            }
            entry.cleanups.push(cleanup);
          },
        };
        try {
          await entry.definition.initialize(scope);
          entry.state = 'running';
        } catch (error) {
          entry.state = 'failed';
          throw error;
        } finally {
          scopeOpen = false;
        }
      }
    } catch (error) {
      const cleanupErrors = await this.cleanupStarted();
      if (cleanupErrors.length) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          'Module initialization and rollback cleanup failed',
        );
      }
      throw error;
    }
  }

  private async cleanupStarted(): Promise<unknown[]> {
    const errors: unknown[] = [];
    while (this.started.length) {
      const entry = this.started.pop()!;
      if (entry.state !== 'failed') {
        entry.state = 'stopped';
      }
      while (entry.cleanups.length) {
        const cleanup = entry.cleanups.pop()!;
        try {
          await cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
    }
    return errors;
  }
}
