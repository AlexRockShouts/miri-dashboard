// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'katex/dist/contrib/auto-render.mjs' {
    const renderMathInElement: (element: HTMLElement, options?: any) => void;
    export default renderMathInElement;
}

export {};
