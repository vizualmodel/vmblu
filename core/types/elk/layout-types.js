export function makeDiagnostic(code, message, detail = null) {
    return detail ? {code, message, detail} : {code, message}
}

export function ok(patch, diagnostics = []) {
    return {ok: true, patch, diagnostics}
}

export function fail(error, diagnostics = []) {
    return {ok: false, error, diagnostics}
}

