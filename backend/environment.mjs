import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

export function loadEnvironment(path = fileURLToPath(new URL('../.env', import.meta.url))) {
    try {
        // Node parses quoted values and preserves variables supplied by the host.
        loadEnvFile(path);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}
