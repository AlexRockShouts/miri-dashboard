<script lang="ts">
    import { marked } from 'marked';
    import dompurify from 'dompurify';

    let { content = '' } = $props();

    const renderer = new marked.Renderer();
    
    // Customize headers to look better in chat - making them even leaner
    renderer.heading = ({ text, depth }) => {
        const sizes = [
            'text-sm font-semibold mt-0.5 mb-0',
            'text-xs font-semibold mt-0.5 mb-0',
            'text-xs font-medium mt-0.25 mb-0',
            'text-xs font-medium mt-0.25 mb-0',
            'text-xs font-medium mt-0.25 mb-0',
            'text-xs font-medium mt-0.25 mb-0',
        ];
        const sizeClass = sizes[depth - 1] || 'font-semibold';
        return `<h${depth} class="${sizeClass}">${text}</h${depth}>`;
    };

    // Handle bullet points - making them even leaner
    renderer.list = ({ items, ordered, start }) => {
        const type = ordered ? 'ol' : 'ul';
        const listClass = ordered ? 'list-decimal ml-3 space-y-0' : 'list-disc ml-3 space-y-0';
        let body = '';
        for (const item of items) {
            body += renderer.listitem(item);
        }
        return `<${type} class="${listClass} mb-0.5 last:mb-0">${body}</${type}>`;
    };

    renderer.listitem = ({ text, task, checked }) => {
        return `<li class="leading-normal">${text}</li>`;
    };

    // Improve formatting for bold text
    renderer.strong = ({ text }) => {
        return `<strong class="font-medium text-foreground">${text}</strong>`;
    };

    // Make links clickable and open in new tab
    renderer.link = ({ href, title, text }) => {
        const titleAttr = title ? ` title="${title}"` : '';
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80 transition-colors">${text}</a>`;
    };

    marked.setOptions({
        renderer,
        gfm: true,
        breaks: true
    });

    let renderedContent = $derived.by(() => {
        const rawHtml = marked.parse(content) as string;
        // In browser environment, use dompurify
        if (typeof window !== 'undefined') {
            return dompurify.sanitize(rawHtml);
        }
        return rawHtml;
    });
</script>

<div class="markdown-content">
    {@html renderedContent}
</div>

<style>
    :global(.markdown-content p) {
        margin-bottom: 0.05rem;
        line-height: 1.4;
    }
    :global(.markdown-content p:last-child) {
        margin-bottom: 0;
    }
    :global(.markdown-content ul, .markdown-content ol) {
        margin-bottom: 0.05rem;
    }
    :global(.markdown-content li) {
        line-height: 1.4;
    }
    :global(.markdown-content code) {
        background-color: rgba(0, 0, 0, 0.04);
        padding: 0.025rem 0.15rem;
        border-radius: 0.125rem;
        font-family: monospace;
        font-size: 0.85em;
    }
    :global(.markdown-content pre) {
        background-color: rgba(0, 0, 0, 0.04);
        padding: 0.3rem;
        border-radius: 0.25rem;
        overflow-x: auto;
        margin-bottom: 0.2rem;
        font-size: 0.8em;
        line-height: 1.3;
    }
</style>
