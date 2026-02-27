<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";

	let { children, open = $bindable(false), ...restProps }: PopoverPrimitive.RootProps = $props();
</script>

<PopoverPrimitive.Root bind:open {...restProps}>
	{@render children?.()}
</PopoverPrimitive.Root>
