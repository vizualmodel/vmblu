const fs = require('fs');
const path = require('path');

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  const errors = [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push('Top-level value must be an object.');
    return errors;
  }

  if (typeof data.version !== 'string') {
    errors.push('Missing or invalid `version` string.');
  }
  if (typeof data.generatedAt !== 'string' || Number.isNaN(Date.parse(data.generatedAt))) {
    errors.push('`generatedAt` must be an ISO date-time string.');
  }
  if (!Array.isArray(data.entries)) {
    errors.push('`entries` must be an array.');
  } else {
    data.entries.forEach((entry, idx) => {
      const prefix = `entries[${idx}]`;
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        errors.push(`${prefix} must be an object.`);
        return;
      }
      if (typeof entry.node !== 'string') {
        errors.push(`${prefix}.node must be a string.`);
      }
      if (!Array.isArray(entry.handles)) {
        errors.push(`${prefix}.handles must be an array.`);
      } else {
        entry.handles.forEach((handle, hid) => {
          const hp = `${prefix}.handles[${hid}]`;
          if (typeof handle !== 'object' || handle === null || Array.isArray(handle)) {
            errors.push(`${hp} must be an object.`);
            return;
          }
          const requiredHandleFields = ['pin', 'handler', 'file', 'line', 'summary', 'returns', 'examples', 'params'];
          requiredHandleFields.forEach(field => {
            if (!(field in handle)) {
              errors.push(`${hp}.${field} is required.`);
            }
          });
          if (typeof handle.pin !== 'string') {
            errors.push(`${hp}.pin must be a string.`);
          }
          if (typeof handle.handler !== 'string') {
            errors.push(`${hp}.handler must be a string.`);
          }
          if (typeof handle.file !== 'string') {
            errors.push(`${hp}.file must be a string.`);
          }
          if (!Number.isInteger(handle.line) || handle.line < 1) {
            errors.push(`${hp}.line must be a positive integer.`);
          }
          if (typeof handle.summary !== 'string') {
            errors.push(`${hp}.summary must be a string.`);
          }
          if (typeof handle.returns !== 'string') {
            errors.push(`${hp}.returns must be a string.`);
          }
          if (!Array.isArray(handle.examples) || !handle.examples.every(example => typeof example === 'string')) {
            errors.push(`${hp}.examples must be an array of strings.`);
          }
          if (!Array.isArray(handle.params)) {
            errors.push(`${hp}.params must be an array.`);
          } else {
            handle.params.forEach((param, pid) => {
              const pp = `${hp}.params[${pid}]`;
              if (typeof param !== 'object' || param === null || Array.isArray(param)) {
                errors.push(`${pp} must be an object.`);
                return;
              }
              const requiredParamFields = ['name', 'type', 'description'];
              requiredParamFields.forEach(field => {
                if (!(field in param)) {
                  errors.push(`${pp}.${field} is required.`);
                }
              });
              if (typeof param.name !== 'string' || typeof param.type !== 'string' || typeof param.description !== 'string') {
                errors.push(`${pp} fields must be strings.`);
              }
            });
          }
        });
      }

      if (!Array.isArray(entry.transmits)) {
        errors.push(`${prefix}.transmits must be an array.`);
      } else {
        entry.transmits.forEach((tx, tid) => {
          const tp = `${prefix}.transmits[${tid}]`;
          if (typeof tx !== 'object' || tx === null || Array.isArray(tx)) {
            errors.push(`${tp} must be an object.`);
            return;
          }
          const requiredTransmitFields = ['pin', 'file', 'line'];
          requiredTransmitFields.forEach(field => {
            if (!(field in tx)) {
              errors.push(`${tp}.${field} is required.`);
            }
          });
          if (typeof tx.pin !== 'string') {
            errors.push(`${tp}.pin must be a string.`);
          }
          if (typeof tx.file !== 'string') {
            errors.push(`${tp}.file must be a string.`);
          }
          if (!Number.isInteger(tx.line) || tx.line < 1) {
            errors.push(`${tp}.line must be a positive integer.`);
          }
        });
      }
    });
  }

  return errors;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node validate-srcdoc.cjs <files...>');
  process.exit(1);
}

let hasErrors = false;
for (const file of files) {
  const resolved = path.resolve(file);
  const issues = validateFile(resolved);
  if (issues.length > 0) {
    hasErrors = true;
    console.error(`Validation errors in ${resolved}:`);
    issues.forEach(issue => console.error('  -', issue));
  } else {
    console.log(`${resolved} ✔ conforms to schema expectations.`);
  }
}

if (hasErrors) process.exit(1);
