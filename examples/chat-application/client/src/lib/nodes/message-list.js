import MessageList from '../ui/MessageList.svelte';

/** 
 * @node MessageList
 */

export function createMessageList(tx, sx) {
  const host = document.createElement('div');
  host.className = 'message-list-host';
  host.dataset.node = 'message-list';
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

  const component = new MessageList({
    target: host,
    props: {
      messages: [],
      onReady: emitDiv
    }
  });

  function normalizeMessages(payload) {
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry, index) => ({
        id: entry.id ?? `msg-${index}-${entry.createdAt ?? Date.now()}`,
        author: entry.author ?? 'Unknown',
        text: entry.text ?? '',
        createdAt: entry.createdAt ?? null,
        direction: entry.direction ?? 'incoming'
      }));
  }

  return {
    onShowMessages(payload) {
      component.$set({ messages: normalizeMessages(payload) });
    }
  };
}
