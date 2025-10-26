const bundleUrl = new URL('./profile.bundle.js', import.meta.url);
const sourceUrl = new URL('./profile.js', import.meta.url);

let profileModulePromise;

export const command = 'profile <model-file>';
export const describe = 'Find message handlers and message transmissions.';

export const builder = [
  { flag: '--out <file>', desc: 'specifies the output file' },
  { flag: '--full', desc: 'check all source files in the model' },
  { flag: '--changed <files...>', desc: 'only check changed files' },
  { flag: '--deleted <files...>', desc: 'remove data from deleted files' },
  { flag: '--delta-file <path>', desc: 'write the delta to a file' },
  { flag: '--reason <text>', desc: 'information' }
];

export async function profile(argv) {
  const mod = await getProfileModule();
  if (typeof mod.profile !== 'function') {
    throw new Error('Profile module does not export a runnable profile function.');
  }
  return mod.profile(argv);
}

export const handler = async (argv) => profile(argv);

function getProfileModule() {
  if (!profileModulePromise) {
    profileModulePromise = loadProfileModule();
  }
  return profileModulePromise;
}

async function loadProfileModule() {
  try {
    return await import(bundleUrl);
  } catch (err) {
    if (isModuleNotFound(err)) {
      return import(sourceUrl);
    }
    throw err;
  }
}

function isModuleNotFound(err) {
  const message = err?.message ?? '';
  return err?.code === 'ERR_MODULE_NOT_FOUND' || message.includes('Cannot find module');
}
