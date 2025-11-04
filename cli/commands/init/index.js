// vmblu init [targetDir] --name <project> --schema <ver> --force --dry-run
import path from 'path';
import { fileURLToPath } from 'url';
import { initProject } from './init-project.js';
import pckg from '../../package.json' assert { type: 'json' };


const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const command = 'init <folder name>';
export const describe = 'Scaffold an empty vmblu project';
export const builder = [
  { flag: '--name <project>', desc: 'Project name (default: folder name)' },
  { flag: '--schema <ver>',   desc: 'Schema version (default: latest version)' },
  { flag: '--force',          desc: 'Overwrite existing files' },
  { flag: '--dry-run',        desc: 'Show actions without writing' }
];

export const handler = async (argv) => {
  // tiny arg parse (no deps)
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--schema') args.schema = argv[++i];
    else if (!a.startsWith('-')) args._.push(a);
  }

  const targetDir = path.resolve(args._[0] || '.');
  const projectName = args.name || path.basename(targetDir);
  const schemaVersion = args.schema || pckg.schemaVersion;

  await initProject({
    targetDir,
    projectName,
    schemaVersion,
    force: Boolean(args.force),
    dryRun: Boolean(args.dryRun),
    templatesDir: path.join(__dirname, '..', '..', 'templates'),
    ui: {
      info: (m) => console.log(m),
      warn: (m) => console.warn(m),
      error: (m) => console.error(m)
    }
  });

  console.log(`vmblu project scaffolded in ${targetDir}`);
};

