// vmblu init [targetDir] --name <project> --schema <ver> --force --dry-run
const path = require('path');
const { initProject } = require('./init-project');

exports.command = 'init';
exports.describe = 'Scaffold an empty vmblu project';
exports.builder = [
  { flag: '--name <project>', desc: 'Project name (default: folder name)' },
  { flag: '--schema <ver>',   desc: 'Schema version (default: 0.8.2)' },
  { flag: '--force',          desc: 'Overwrite existing files' },
  { flag: '--dry-run',        desc: 'Show actions without writing' }
];

exports.handler = async (argv) => {
  // tiny arg parse (no deps)
  const args = { _: [] };
  for (let i=0;i<argv.length;i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--schema') args.schema = argv[++i];
    else if (!a.startsWith('-')) args._.push(a);
  }

  const targetDir = path.resolve(args._[0] || '.');
  const projectName = args.name || path.basename(targetDir);
  const schemaVersion = args.schema || '0.8.2';

  await initProject({
    targetDir,
    projectName,
    schemaVersion,
    force: !!args.force,
    dryRun: !!args.dryRun,
    templatesDir: path.join(__dirname, '..', '..', 'templates'),
    ui: {
      info: (m) => console.log(m),
      warn: (m) => console.warn(m),
      error: (m) => console.error(m)
    }
  });

  console.log(`✔ vmblu project scaffolded in ${targetDir}`);
};
