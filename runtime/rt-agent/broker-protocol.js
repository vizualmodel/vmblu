export const BrokerRequestTypes = Object.freeze({
    CAPABILITIES_LIST: 'capabilities.list',
    TOOL_CALL: 'tool.call',
    PROBE_READ: 'probe.read',
    EVENT_WAIT: 'event.wait',
    EVENTS_QUERY: 'events.query',
})

export const BrokerResultTypes = Object.freeze({
    CAPABILITIES_RESULT: 'capabilities.result',
    TOOL_RESULT: 'tool.result',
    PROBE_RESULT: 'probe.result',
    EVENT_RESULT: 'event.result',
    EVENTS_RESULT: 'events.result',
    BROKER_ERROR: 'broker.error',
})

export const ToolResultStatus = Object.freeze({
    ACCEPTED: 'accepted',
    COMPLETED: 'completed',
    VERIFIED: 'verified',
    FAILED: 'failed',
    TIMEOUT: 'timeout',
    DENIED: 'denied',
})

export function brokerError(request, code, message, details = undefined) {
    return {
        type: BrokerResultTypes.BROKER_ERROR,
        requestId: request?.requestId,
        error: {
            code,
            message,
            details,
        },
    }
}
