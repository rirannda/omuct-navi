<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { Destination } from '#lib';
	import PoiSearchList from '#lib/components/elements/PoiSearchList.svelte';
	import Fuse from 'fuse.js';
	import { pois } from '../../../data/pois';
	import { markers } from '../../../data/markers';

	const defaultDestinations: readonly Destination[] = [...pois, ...markers];

	let {
		onselect,
		onsearch,
		large,
		placeholder = '場所を検索',
		label = placeholder,
		query = $bindable(''),
		inlineResults = false,
		resultsMaxHeight = '12.5rem',
		destinations = defaultDestinations,
		...rest
	}: {
		onselect: (poiId: string) => void;
		onsearch?: (query: string) => void;
		large?: boolean;
		placeholder?: string;
		label?: string;
		query?: string;
		inlineResults?: boolean;
		resultsMaxHeight?: string;
		destinations?: readonly Destination[];
	} & Omit<
		HTMLInputAttributes,
		'value' | 'onselect' | 'placeholder' | 'oninput' | 'onkeydown' | 'onfocus' | 'onblur'
	> = $props();

	// 複数のPoiSearchInputを並べてもIDが衝突しないようにする
	const uid = $props.id();
	const listboxId = `${uid}-listbox`;
	const optionId = (i: number) => `${uid}-option-${i}`;

	const MAX_RESULTS = 20;
	const fuse = $derived(
		new Fuse(destinations, {
			keys: ['name', 'keys'],
			useTokenSearch: true,
			threshold: 0.3,
			ignoreLocation: true
		})
	);

	let open = $state(false);
	let activeIndex = $state(-1);
	let input: HTMLInputElement;

	const results = $derived(
		open && query.trim() ? fuse.search(query.trim(), { limit: MAX_RESULTS }).map((r) => r.item) : []
	);

	function close() {
		open = false;
		activeIndex = -1;
	}

	function oninput() {
		open = true;
		activeIndex = -1;
		onsearch?.(query);
	}

	function select(poi: Destination) {
		query = poi.name;
		close();
		onselect(poi.id);
		input.blur();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.isComposing) return;
		const n = results.length;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			open = true;
			if (n === 0) return;
			const step = e.key === 'ArrowDown' ? 1 : -1;
			activeIndex = activeIndex < 0 ? (step > 0 ? 0 : n - 1) : (activeIndex + step + n) % n;
		} else if (e.key === 'Enter' && open && results.length) {
			e.preventDefault();
			select(results[Math.max(0, activeIndex)]);
		} else if (e.key === 'Escape') {
			close();
		}
	}
</script>

<div class={['relative min-w-0', large ? 'w-full max-w-160' : 'w-full']}>
	<div class="relative">
		<input
			bind:this={input}
			type="search"
			class="min-h-13 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 py-3 pr-12 pl-4 text-base text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 [&::-webkit-search-cancel-button]:hidden"
			{placeholder}
			aria-label={label}
			autocomplete="off"
			bind:value={query}
			{oninput}
			{onkeydown}
			onfocus={() => (open = true)}
			onblur={close}
			role="combobox"
			aria-autocomplete="list"
			aria-expanded={results.length > 0}
			aria-controls={listboxId}
			aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
			{...rest}
		/>
		{#if query}
			<button
				type="button"
				class="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-200"
				aria-label={`${label}をクリア`}
				onclick={() => {
					query = '';
					oninput();
					input.focus();
				}}>×</button
			>
		{/if}
	</div>
	{#if open && query.trim()}
		<div class={inlineResults ? 'mt-2' : 'absolute z-10 mt-1 w-full'}>
			<PoiSearchList
				{results}
				{activeIndex}
				{listboxId}
				{optionId}
				maxHeight={resultsMaxHeight}
				onselect={select}
			/>
			{#if results.length === 0}<p class="px-3 py-3 text-sm text-slate-500" role="status">
					一致する場所がありません。
				</p>{/if}
		</div>
	{/if}
</div>
