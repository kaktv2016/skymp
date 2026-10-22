import { writeLogs } from 'skyrimPlatform';

/** Temporary transport diagnostics. No player/chat text or credentials. */
export function rpChatDiagnostic(stage: string, details?: unknown): void {
    try {
        writeLogs('rpChatTransport', new Date().toISOString() + ' ' + stage +
            (details === undefined ? '' : ' ' + JSON.stringify(details)));
    } catch {
        // Logging never changes the existing client behavior.
    }
}
