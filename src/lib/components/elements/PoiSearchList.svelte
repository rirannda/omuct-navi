<script lang="ts">
	import type { Destination } from '#lib';

	let {
		results,
		onselect,
		activeIndex = -1,
		listboxId,
		optionId,
		maxHeight = '12.5rem'
	}: {
		results: Destination[];
		onselect: (poi: Destination) => void;
		activeIndex?: number;
		listboxId: string;
		optionId: (i: number) => string;
		maxHeight?: string;
	} = $props();

	$effect(() => {
		if (activeIndex >= 0) {
			document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
		}
	});
</script>

{#if results.length > 0}
	<ul
		id={listboxId}
		class="overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm"
		style:max-height={maxHeight}
		role="listbox"
	>
		{#each results as poi, i (poi.id)}
			<li id={optionId(i)} role="option" aria-selected={i === activeIndex}>
				<button
					type="button"
					tabindex="-1"
					class="min-h-11 w-full px-4 py-3 text-left text-sm hover:bg-gray-100 {i === activeIndex
						? 'bg-gray-100'
						: ''}"
					onclick={() => onselect(poi)}
					onpointerdown={(event) => event.preventDefault()}
				>
					{poi.name}
				</button>
			</li>
		{/each}
	</ul>
{/if}
