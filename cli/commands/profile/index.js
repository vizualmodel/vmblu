import { profile } from './profile.js';

export const command = 'profile <model-file>';
export const describe = 'Find message handlers and message transmissions.';

export const builder = [
  { flag: '--out <file>', desc: 'specifies the output file' },
  { flag: '--full', desc: 'check all source files in the model' },
  { flag: '--changed <files...>', desc: 'only check changed files' },
  { flag: '--deleted <files...>', desc: 'remove data from deleted files' },
  { flag: '--delta-file <path>', desc: 'write the delta to a file' },
  { flag: '--reason <text>', desc: 'information' },
];

export const handler = profile;

