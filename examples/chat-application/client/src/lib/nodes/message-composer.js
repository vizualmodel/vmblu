import { resolveDisplayName } from '../user/identity.js';
import MessageComposer from '../ui/MessageComposer.svelte';

function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 
 * @node MessageComposer
 */
export function createMessageComposer(tx, sx) {
  const host = document.createElement('div');
  const displayName = resolveDisplayName();
  host.className = 'message-composer-host';
  host.dataset.node = 'message-composer';
  host.style.width = '100%';
  host.style.height = '100%';

  let divSent = false;

  function emitDiv(node) {
    if (divSent) {
      return;
    }

    divSent = true;
    queueMicrotask(() => {
      tx.send('div', node ?? host);
    });
  }

  function handleSubmit(text) {
    const message = {
      id: createId('local'),
      author: displayName,
      text,
      createdAt: new Date().toISOString(),
      direction: 'outgoing'
    };

    tx.send('submitMessage', message);
  }

  new MessageComposer({
    target: host,
    props: {
      onSubmit: handleSubmit,
      onReady: emitDiv
    }
  });

  return {};
}

