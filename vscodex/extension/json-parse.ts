function formatJsonPath(path: Array<string | number>): string {
	if (path.length === 0) return '$';

	let result = '$';
	for (const segment of path) {
		if (typeof segment === 'number') {
			result += `[${segment}]`;
			continue;
		}

		if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(segment)) {
			result += `.${segment}`;
			continue;
		}

		result += `[${JSON.stringify(segment)}]`;
	}
	return result;
}

function decodeJsonString(text: string, start: number): { value: string; end: number } {
	if (text[start] !== '"') throw new Error(`Expected string at ${start}`);

	let i = start + 1;
	let value = '';

	while (i < text.length) {
		const ch = text[i++];

		if (ch === '"') return { value, end: i };

		if (ch !== '\\') {
			value += ch;
			continue;
		}

		const esc = text[i++];
		switch (esc) {
			case '"': value += '"'; break;
			case '\\': value += '\\'; break;
			case '/': value += '/'; break;
			case 'b': value += '\b'; break;
			case 'f': value += '\f'; break;
			case 'n': value += '\n'; break;
			case 'r': value += '\r'; break;
			case 't': value += '\t'; break;
			case 'u': {
				const hex = text.slice(i, i + 4);
				if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error(`Invalid unicode escape at ${i - 2}`);
				value += String.fromCharCode(parseInt(hex, 16));
				i += 4;
				break;
			}
			default:
				throw new Error(`Invalid escape sequence at ${i - 1}`);
		}
	}

	throw new Error(`Unterminated string at ${start}`);
}

function detectDuplicateJsonKeys(text: string): Array<{ key: string; path: string }> {
	const duplicates: Array<{ key: string; path: string }> = [];
	let i = 0;

	const skipWhitespace = () => {
		while (i < text.length && /\s/.test(text[i])) i++;
	};

	const parseLiteral = (literal: string) => {
		if (text.slice(i, i + literal.length) !== literal) throw new Error(`Expected ${literal} at ${i}`);
		i += literal.length;
	};

	const parseNumber = () => {
		const match = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
		if (!match) throw new Error(`Invalid number at ${i}`);
		i += match[0].length;
	};

	const parseString = () => {
		const parsed = decodeJsonString(text, i);
		i = parsed.end;
		return parsed.value;
	};

	const parseValue = (path: Array<string | number> = []) => {
		skipWhitespace();

		const ch = text[i];
		if (ch === '{') return parseObject(path);
		if (ch === '[') return parseArray(path);
		if (ch === '"') return parseString();
		if (ch === 't') return parseLiteral('true');
		if (ch === 'f') return parseLiteral('false');
		if (ch === 'n') return parseLiteral('null');
		return parseNumber();
	};

	const parseArray = (path: Array<string | number>) => {
		i++;
		skipWhitespace();
		if (text[i] === ']') {
			i++;
			return;
		}

		let index = 0;
		while (i < text.length) {
			parseValue(path.concat(index));
			skipWhitespace();

			if (text[i] === ']') {
				i++;
				return;
			}

			if (text[i] !== ',') throw new Error(`Expected , or ] at ${i}`);
			i++;
			index++;
		}
	};

	const parseObject = (path: Array<string | number>) => {
		i++;
		skipWhitespace();
		if (text[i] === '}') {
			i++;
			return;
		}

		const seen = new Set<string>();

		while (i < text.length) {
			skipWhitespace();
			const key = parseString();
			skipWhitespace();
			if (text[i] !== ':') throw new Error(`Expected : at ${i}`);
			i++;

			if (seen.has(key)) duplicates.push({ key, path: formatJsonPath(path.concat(key)) });
			else seen.add(key);

			parseValue(path.concat(key));
			skipWhitespace();

			if (text[i] === '}') {
				i++;
				return;
			}

			if (text[i] !== ',') throw new Error(`Expected , or } at ${i}`);
			i++;
		}
	};

	parseValue([]);
	skipWhitespace();
	if (i !== text.length) throw new Error(`Unexpected trailing content at ${i}`);

	return duplicates;
}

export function parseJsonWithDuplicateKeyWarning(text: string, source = 'JSON', warn: (message: string) => void = console.warn): any {
	const value = JSON.parse(text);

	try {
		const duplicates = detectDuplicateJsonKeys(text);
		if (duplicates.length > 0) {
			const locations = duplicates.map(dup => dup.path).join(', ');
			warn(`[vmblu] Duplicate JSON key(s) detected in ${source}: ${locations}`);
		}
	}
	catch {
		// Let JSON.parse remain the source of truth for syntax errors.
	}

	return value;
}
