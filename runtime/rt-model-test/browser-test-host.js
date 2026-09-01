export class BrowserTestHost {
    constructor({document=globalThis.document, root=null, settle=null}={}) {
        if (!document) throw new Error('BrowserTestHost requires a browser document')
        this.document = document
        this.root = root ?? document.body
        this.ownsRoot = false
        this.settleCallback = settle
        this.mountedView = null
    }

    async mount(view) {
        const element = view?.element ?? view
        if (!element || typeof element !== 'object') throw new Error('The view reply does not contain a DOM element')

        if (!this.root) {
            this.root = this.document.createElement('div')
            this.document.body.append(this.root)
            this.ownsRoot = true
        }
        if (!this.root.contains?.(element)) this.root.append(element)
        this.mountedView = element
        await this.settle()
        return element
    }

    async execute(action) {
        if (action.kind === 'click') {
            const element = this.locateOne(action.locator)
            element.click()
        }
        else if (action.kind === 'fill') {
            const element = this.locateOne(action.locator)
            element.focus?.()
            element.value = action.value
            element.dispatchEvent(new this.document.defaultView.Event('input', {bubbles: true}))
            element.dispatchEvent(new this.document.defaultView.Event('change', {bubbles: true}))
        }
        else if (action.kind === 'wait') {
            await delay(action.ms)
        }
        else throw new Error(`Unsupported browser test action: ${action.kind}`)

        await this.settle()
    }

    async assert(expectation) {
        await this.settle()
        const elements = this.locate(expectation.locator)
        const failures = []

        const requiresMatch = expectation.count === undefined
            || expectation.count > 0
            || expectation.text !== undefined
            || expectation.class !== undefined
            || expectation.visible === true
        if (requiresMatch && elements.length === 0) failures.push('locator matched no elements')

        if (expectation.count !== undefined && elements.length !== expectation.count) {
            failures.push(`expected ${expectation.count} matching element(s), observed ${elements.length}`)
        }
        if (expectation.visible !== undefined) {
            const visible = elements.filter(isVisible).length
            const expected = expectation.visible ? elements.length : 0
            if (visible !== expected) failures.push(`expected visible=${expectation.visible}, observed ${visible} visible element(s)`)
        }
        if (expectation.text !== undefined) {
            const texts = elements.map(element => String(element.textContent ?? '').trim())
            const expectedTexts = Array.isArray(expectation.text) ? expectation.text : [expectation.text]
            if (!expectedTexts.every((text, index) => texts[index]?.includes(String(text)))) {
                failures.push(`expected text ${JSON.stringify(expectedTexts)}, observed ${JSON.stringify(texts)}`)
            }
        }
        if (expectation.class !== undefined) {
            const classes = Array.isArray(expectation.class) ? expectation.class : [expectation.class]
            for (const className of classes) {
                if (!elements.every(element => element.classList?.contains(className))) {
                    failures.push(`expected every matching element to have class '${className}'`)
                }
            }
        }

        return failures.length ? {
            message: `View expectation failed: ${failures.join('; ')}`,
            expected: expectation,
            observed: elements.map(element => ({
                text: String(element.textContent ?? '').trim(),
                class: typeof element.className === 'string' ? element.className : '',
            })),
        } : null
    }

    locate(locator={}) {
        const root = this.mountedView ?? this.root ?? this.document
        if (locator.css) return [...root.querySelectorAll(locator.css)]

        if (locator.role) {
            const selector = roleSelector(locator.role)
            return [...root.querySelectorAll(selector)].filter(element => {
                if (element.getAttribute?.('role') && element.getAttribute('role') !== locator.role) return false
                if (locator.name === undefined) return true
                return accessibleName(element).includes(String(locator.name))
            })
        }

        throw new Error('A browser locator requires either css or role')
    }

    locateOne(locator) {
        const elements = this.locate(locator)
        const index = locator?.index ?? 0
        if (!elements[index]) throw new Error(`Browser locator matched no element at index ${index}`)
        return elements[index]
    }

    async settle() {
        if (this.settleCallback) return this.settleCallback()
        await Promise.resolve()
        if (typeof globalThis.requestAnimationFrame === 'function') {
            await new Promise(resolve => globalThis.requestAnimationFrame(() => resolve()))
        }
        else await delay(0)
    }

    async stop() {
        if (this.ownsRoot) this.root?.remove?.()
        else if (this.mountedView?.parentNode === this.root) this.mountedView.remove?.()
        this.mountedView = null
    }
}

function roleSelector(role) {
    const native = {
        button: 'button,[role="button"]',
        link: 'a[href],[role="link"]',
        textbox: 'input:not([type]),input[type="text"],input[type="email"],input[type="search"],textarea,[role="textbox"]',
        checkbox: 'input[type="checkbox"],[role="checkbox"]',
    }
    return native[role] ?? `[role="${cssEscape(role)}"]`
}

function accessibleName(element) {
    const explicit = element.getAttribute?.('aria-label') ?? element.getAttribute?.('title')
    if (explicit) return String(explicit).trim()
    const text = String(element.textContent ?? '').trim()
    return text || String(element.value ?? '').trim()
}

function isVisible(element) {
    if (element.hidden) return false
    const style = element.ownerDocument?.defaultView?.getComputedStyle?.(element)
    return !style || (style.display !== 'none' && style.visibility !== 'hidden')
}

function cssEscape(value) {
    return String(value).replace(/["\\]/g, '\\$&')
}

function delay(ms=0) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
