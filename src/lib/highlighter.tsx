import * as React from 'react'
import {createHighlighterCore, type GrammarState, type HighlighterCore} from 'shiki/core'
import {createJavaScriptRegexEngine} from 'shiki/engine/javascript'

// Add the languages you need. Each one loads the first time it is used.
const languages = {
	bash: () => import('shiki/langs/shellscript.mjs'),
	css: () => import('shiki/langs/css.mjs'),
	diff: () => import('shiki/langs/diff.mjs'),
	html: () => import('shiki/langs/html.mjs'),
	javascript: () => import('shiki/langs/javascript.mjs'),
	json: () => import('shiki/langs/json.mjs'),
	jsx: () => import('shiki/langs/jsx.mjs'),
	markdown: () => import('shiki/langs/markdown.mjs'),
	python: () => import('shiki/langs/python.mjs'),
	sql: () => import('shiki/langs/sql.mjs'),
	tsx: () => import('shiki/langs/tsx.mjs'),
	typescript: () => import('shiki/langs/typescript.mjs'),
	yaml: () => import('shiki/langs/yaml.mjs'),
}

const aliases = new Map<string, keyof typeof languages>([
	['js', 'javascript'],
	['md', 'markdown'],
	['py', 'python'],
	['sh', 'bash'],
	['shell', 'bash'],
	['shellscript', 'bash'],
	['ts', 'typescript'],
	['yml', 'yaml'],
	['zsh', 'bash'],
])

type Language = keyof typeof languages

function isLanguage(name: string): name is Language {
	return Object.hasOwn(languages, name)
}

let highlighter: Promise<HighlighterCore> | undefined

function getHighlighter() {
	highlighter ??= createHighlighterCore({
		themes: [import('shiki/themes/kanagawa-lotus.mjs'), import('shiki/themes/kanagawa-dragon.mjs')],
		langs: [],
		engine: createJavaScriptRegexEngine({forgiving: true}),
	})

	return highlighter
}

function getLanguage(language: string) {
	const name = language.toLowerCase()

	if (name === 'ansi') {
		return name
	}

	if (isLanguage(name)) {
		return name
	}

	return aliases.get(name) ?? null
}

// Loads a language and returns a highlighter for it, or null for a language
// that is not listed.
export async function loadHighlighter(language: string) {
	const lang = getLanguage(language)

	if (!lang) {
		return null
	}

	const shiki = await getHighlighter()

	if (lang !== 'ansi' && !shiki.getLoadedLanguages().includes(lang)) {
		await shiki.loadLanguage(languages[lang])
	}

	return {
		// Returns one React node per line, and the grammar state after the last
		// line. Pass that state back to continue where the code left off.
		highlight(code: string, state?: GrammarState) {
			const tokenize = (text: string) =>
				shiki.codeToTokens(text, {
					lang,
					themes: {light: 'kanagawa-lotus', dark: 'kanagawa-dragon'},
					defaultColor: false,
					grammarState: state,
				}).tokens

			// ANSI has no grammar state, so each line is tokenized on its own and
			// gets the same colors whether it arrives in one piece or streams.
			const tokens =
				lang === 'ansi' ? code.split('\n').flatMap((line) => tokenize(line)) : tokenize(code)

			return {
				lines: tokens.map((line) =>
					line.map((token, index) => (
						<span
							key={index}
							// SAFETY: Shiki emits CSS declarations keyed by CSS property; React accepts that shape.
							style={token.htmlStyle as React.CSSProperties}
							className="text-(--shiki-light) dark:text-(--shiki-dark)"
						>
							{token.content}
						</span>
					)),
				),
				state: shiki.getLastGrammarState(tokens),
			}
		},
	}
}

// Returns one React node per line, or null for a language that is not listed.
export async function highlightCode(code: string, language: string) {
	const loaded = await loadHighlighter(language)

	return loaded ? loaded.highlight(code).lines : null
}
