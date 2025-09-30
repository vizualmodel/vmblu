import ChatPage from '../ui/ChatPage.svelte';

/**
 * @node ChatPage
 */
export function createChatPage(tx, sx) {
  const host = document.createElement('div');
  host.className = 'chat-page-host';
  host.dataset.node = 'chat-page';
  host.style.minHeight = '100vh';
  host.style.width = '100%';

  if (!document.body.contains(host)) {
    document.body.appendChild(host);
  }

  const component = new ChatPage({
    target: host,
    props: {
      composerNode: null,
      listNode: null
    }
  });

  function normalizeNode(node) {
    return node instanceof HTMLElement ? node : null;
  }

  return {
    /**
     * @pin ComposerDiv
     * @param {*} payload 
     */
    onComposerDiv(payload) {
      component.$set({ composerNode: normalizeNode(payload) });
    },
    onListDiv(payload) {
      component.$set({ listNode: normalizeNode(payload) });
    }
  };
}
