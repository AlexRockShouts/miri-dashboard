<script lang="ts">
    import { marked } from 'marked';
    import dompurify from 'dompurify';
    import { codeToHtml } from 'shiki';
    // @ts-ignore
    import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
    import 'katex/dist/katex.min.css';

    let { content = '' } = $props();

    const renderer = new marked.Renderer();
    
    // Customize headers to look better in chat - making them clear and readable
    renderer.heading = ({ text, depth }) => {
        const sizes = [
            'text-base font-bold mt-4 mb-2',
            'text-sm font-bold mt-3 mb-1.5',
            'text-xs font-semibold mt-2 mb-1',
            'text-xs font-medium mt-2 mb-1',
            'text-xs font-medium mt-2 mb-1',
            'text-xs font-medium mt-2 mb-1',
        ];
        const sizeClass = sizes[depth - 1] || 'font-semibold';
        return `<h${depth} class="${sizeClass}">${text}</h${depth}>`;
    };

    renderer.list = (token) => {
        const type = token.ordered ? 'ol' : 'ul';
        const listClass = token.ordered ? 'list-decimal ml-6 space-y-1.5' : 'list-disc ml-6 space-y-1.5';
        let body = '';
        for (const item of token.items) {
            body += renderer.listitem(item);
        }
        return `<${type} class="${listClass} my-3 last:mb-0">${body}</${type}>`;
    };

    renderer.listitem = (token) => {
        // In marked v17, we should use marked.parser with the item's tokens
        // to correctly handle nesting and inline elements.
        let content = token.tokens ? marked.parser(token.tokens) : token.text;
        
        if (token.task) {
            const checked = token.checked ? 'checked' : '';
            return `<li class="leading-relaxed list-none flex items-start gap-2">
                <input type="checkbox" disabled ${checked} class="mt-1 shrink-0">
                <div class="flex-1">${content}</div>
            </li>`;
        }
        return `<li class="leading-relaxed">${content}</li>`;
    };

    // Improve formatting for bold text
    renderer.strong = ({ text }) => {
        return `<strong class="font-bold text-foreground mx-0.5">${text}</strong>`;
    };

    // Make links clickable and open in new tab
    renderer.link = ({ href, title, text }) => {
        const titleAttr = title ? ` title="${title}"` : '';
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80 transition-colors">${text}</a>`;
    };

    // Syntax highlighting using Shiki
    const codeBlocks = new Map<string, string>();
    let blockCounter = 0;

    renderer.code = ({ text, lang }) => {
        const id = `code-block-${blockCounter++}`;
        codeBlocks.set(id, JSON.stringify({ text, lang }));
        return `<div id="${id}" class="shiki-placeholder my-4 rounded-md overflow-hidden shadow-sm"><pre class="p-3 bg-muted/30"><code class="language-${lang || ''} text-xs">${text}</code></pre></div>`;
    };

    // Use an extension to protect math delimiters from marked
    const mathExtension = {
        name: 'math',
        level: 'inline' as const,
        start(src: string) { return src.match(/\$\$|\\\[|\$|\\\(/)?.index; },
        tokenizer(src: string) {
            // Block math $$ ... $$
            const blockMatch = src.match(/^\$\$([\s\S]+?)\$\$/);
            if (blockMatch) {
                return {
                    type: 'math',
                    raw: blockMatch[0],
                    text: blockMatch[0],
                    display: true
                };
            }
            // LaTeX style block math \[ ... \]
            const latexBlockMatch = src.match(/^\\\[([\s\S]+?)\\\]/);
            if (latexBlockMatch) {
                return {
                    type: 'math',
                    raw: latexBlockMatch[0],
                    text: latexBlockMatch[0],
                    display: true
                };
            }
            // Inline math $ ... $
            const inlineMatch = src.match(/^\$([^\$\n]+?)\$/);
            if (inlineMatch) {
                return {
                    type: 'math',
                    raw: inlineMatch[0],
                    text: inlineMatch[0],
                    display: false
                };
            }
            // LaTeX style inline math \( ... \)
            const latexInlineMatch = src.match(/^\\\(([\s\S]+?)\\\)/);
            if (latexInlineMatch) {
                return {
                    type: 'math',
                    raw: latexInlineMatch[0],
                    text: latexInlineMatch[0],
                    display: false
                };
            }
        },
        renderer(token: any) {
            return token.text;
        }
    };

    marked.setOptions({
        renderer,
        gfm: true,
        breaks: true
    });

    marked.use({ extensions: [mathExtension] });

    let renderedContent = $state('');
    let container = $state<HTMLElement | null>(null);

    $effect(() => {
        const render = async () => {
            codeBlocks.clear();
            blockCounter = 0;
            
            // Log raw content to help debug parsing issues
            console.log('Markdown content to parse:', content);
            
            // Use marked.parse directly, but ensure extensions are reset/handled
            // Note: marked.use is global, so it stays active.
            let html = await marked.parse(content);
            console.log('Parsed HTML before sanitization:', html);
            
            // In browser environment, use dompurify
            if (typeof window !== 'undefined') {
                html = dompurify.sanitize(html, {
                    // Be more permissive with MathML and SVG to ensure KaTeX works
                    // and doesn't get partially stripped before auto-render
                    USE_PROFILES: { html: true, svg: true, mathMl: true },
                    ADD_ATTR: ['target'] // Allow target="_blank" for links
                });
            }
            
            renderedContent = html;

            // Use requestAnimationFrame to wait for the DOM to update after setting renderedContent
            requestAnimationFrame(async () => {
                if (container) {
                    renderMathInElement(container, {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false},
                            {left: '\\(', right: '\\)', display: false},
                            {left: '\\[', right: '\\]', display: true}
                        ],
                        throwOnError: false,
                        strict: 'ignore'
                    });
                }

                for (const [id, dataStr] of codeBlocks) {
                    const { text, lang } = JSON.parse(dataStr);
                    try {
                        const highlighted = await codeToHtml(text, {
                            lang: lang || 'text',
                            theme: 'github-light'
                        });
                        
                        const el = document.getElementById(id);
                        if (el) {
                            el.innerHTML = highlighted;
                            el.classList.remove('shiki-placeholder');
                        }
                    } catch (e) {
                        console.error('Shiki highlighting failed for', id, e);
                    }
                }
            });
        };

        render();
    });
</script>

<div class="markdown-content" bind:this={container}>
    {@html renderedContent}
</div>

<style>
    :global(.markdown-content p) {
        margin-bottom: 0.75rem;
        line-height: 1.6;
    }
    :global(.markdown-content p:last-child) {
        margin-bottom: 0;
    }
    :global(.markdown-content ul, .markdown-content ol) {
        margin-bottom: 0.75rem;
        padding-left: 0;
        list-style-position: outside;
    }
    :global(.markdown-content li) {
        line-height: 1.6;
        margin-bottom: 0.25rem;
    }
    :global(.markdown-content li > p) {
        display: inline;
        margin-bottom: 0;
    }
    :global(.markdown-content code) {
        padding: 0.1rem 0.3rem;
        border-radius: 0.25rem;
        font-family: monospace;
        font-size: 0.9em;
    }
    :global(.markdown-content pre) {
        margin-bottom: 1rem;
        font-size: 0.85em;
        line-height: 1.5;
    }
    :global(.markdown-content pre.shiki) {
        background-color: #f6f8fa !important;
        padding: 0.5rem;
        border-radius: 0.375rem;
        overflow-x: auto;
    }
    :global(.katex-display) {
        margin: 0.5rem 0;
        overflow-x: auto;
        overflow-y: hidden;
    }
</style>
