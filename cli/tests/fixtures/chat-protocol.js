export function chatProtocolFixture() {
  return {
    header: {
      version: '1.11.0',
      name: 'Chat',
      description: 'Login, history delivery, and live chat messages between the browser client and chat server.',
    },
    interactions: [
      {
        id: 'login',
        flow: 'right',
        type: 'Login',
        response: [
          {id: 'login-accepted'},
          {id: 'chat-history', remark: 'The server sends the current history after accepting the login.'},
        ],
      },
      {id: 'send-chat-message', flow: 'right', type: 'SendChatMessage', response: []},
      {id: 'login-accepted', flow: 'left', type: 'LoginAccepted', response: []},
      {id: 'chat-history', flow: 'left', type: 'ChatHistory', response: []},
      {id: 'receive-chat-message', flow: 'left', type: 'ReceiveChatMessage', response: []},
    ],
    types: {
      Login: {
        kind: 'object',
        summary: 'Client login envelope.',
        fields: {
          type: {vmbluType: 'string'},
          userName: {vmbluType: 'string'},
        },
        required: ['type', 'userName'],
      },
      SendChatMessage: {
        kind: 'object',
        summary: 'Chat message envelope sent by a client.',
        fields: {
          type: {vmbluType: 'string'},
          userId: {vmbluType: 'string'},
          text: {vmbluType: 'string'},
        },
        required: ['type', 'userId', 'text'],
      },
      LoginAccepted: {
        kind: 'object',
        summary: 'Successful login envelope returned by the server.',
        fields: {
          type: {vmbluType: 'string'},
          userId: {vmbluType: 'string'},
          userName: {vmbluType: 'string'},
        },
        required: ['type', 'userId', 'userName'],
      },
      ChatMessage: {
        kind: 'object',
        summary: 'One stored chat message.',
        fields: {
          id: {vmbluType: 'string'},
          userId: {vmbluType: 'string'},
          userName: {vmbluType: 'string'},
          text: {vmbluType: 'string'},
          sentAt: {vmbluType: 'string'},
        },
        required: ['id', 'userId', 'userName', 'text', 'sentAt'],
      },
      ChatMessages: {
        kind: 'array',
        summary: 'A list of stored chat messages.',
        items: {vmbluType: 'ChatMessage'},
      },
      ChatHistory: {
        kind: 'object',
        summary: 'Current chat history returned after login.',
        fields: {
          type: {vmbluType: 'string'},
          messages: {vmbluType: 'ChatMessages'},
        },
        required: ['type', 'messages'],
      },
      ReceiveChatMessage: {
        kind: 'object',
        summary: 'Server broadcast envelope containing one stored chat message.',
        fields: {
          type: {vmbluType: 'string'},
          message: {vmbluType: 'ChatMessage'},
        },
        required: ['type', 'message'],
      },
    },
  }
}
