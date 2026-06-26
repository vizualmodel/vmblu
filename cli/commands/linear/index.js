const sourceUrl = new URL('../../../linear/nodes/linear-cli/index.js', import.meta.url);

export const command = 'linear <subcommand>';
export const describe = 'Analyze and profile conventional JavaScript/TypeScript code with the vmblu Linear Code Model.';

export const builder = [
  { flag: 'analyze [project-root]', desc: 'write a .vmlc.json evidence model' },
  { flag: 'profile <query>', desc: 'profile callers, imports, or dependencies from a .vmlc.json model' },
  { flag: '--out <file>', desc: 'analysis output file' },
  { flag: '--model <file>', desc: 'profile model file' }
];

export const handler = async (argv) => {
  const mod = await import(sourceUrl);
  if (typeof mod.handler !== 'function') {
    throw new Error('Linear command module does not export a runnable handler.');
  }
  return mod.handler(argv);
};
