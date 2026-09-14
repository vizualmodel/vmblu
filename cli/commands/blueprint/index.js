import {validateBlueprint} from '../../lib/blueprint-validation.js';
export const command = 'blueprint validate [directory]';
export const describe = 'Check Blueprint structure locally. Validation does not approve or publish a project.';
export const builder = [{flag: '--json', desc: 'Print a machine-readable validation result'}];
export function handler(args) {
  const [action, ...rest] = args;
  const directories = rest.filter(arg => !arg.startsWith('-'));
  if (action !== 'validate' || directories.length > 1 || rest.some(arg => arg.startsWith('-') && arg !== '--json')) throw new Error('Usage: vmblu blueprint validate [directory] [--json]');
  const result = validateBlueprint(directories[0]);
  console.log(rest.includes('--json') ? JSON.stringify(result, null, 2) : result.valid ? 'Blueprint structure is valid. Catalogue approval is separate.' : result.errors.map(error => `- ${error}`).join('\n'));
  if (!result.valid) process.exitCode = 1;
}
