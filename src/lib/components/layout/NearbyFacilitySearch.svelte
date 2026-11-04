<script lang="ts">
	import type { NavigationState } from '../../states/navigation.svelte';
	import type { FacilityCategory } from '../../map/nearbyFacilities';
	import type { ToiletType } from '../../../data/types';
	import { buildingNames } from '../../../data/buildings';
	import { singleLineDestinationName } from '../../destinationName';
	import { formatFloorLabel } from '../../map/floorDisplay';
	import { onDestroy } from 'svelte';

	let {
		navigation,
		showButtons,
		showSearch,
		onsearch,
		onselect
	}: {
		navigation: NavigationState;
		showButtons: boolean;
		showSearch: boolean;
		onsearch: () => void;
		onselect: (id: string) => void;
	} = $props();
	const uid = $props.id();
	const search = $derived(navigation.facilitySearch);
	const gps = $derived(navigation.gpsLocation);
	const results = $derived(navigation.facilityResults);
	const ready = $derived(!!search && (gps.enabled ? !!gps.position : !!search.buildingId));
	const categories: { id: FacilityCategory; label: string }[] = [
		{ id: 'toilet', label: '近くのトイレを表示' },
		{ id: 'trash', label: '近くのゴミ箱を表示' }
	];
	let disposed = false;
	onDestroy(() => (disposed = true));
	async function searchNearby(category: FacilityCategory) {
		await navigation.requestGps();
		if (!disposed && navigation.searchFacilities(category)) onsearch();
	}
</script>

{#if showButtons}
	{#each categories as category (category.id)}
		<button
			type="button"
			aria-label={category.label}
			aria-pressed={search?.category === category.id}
			class={[
				'min-h-13 min-w-0 flex-1 rounded-xl border px-2 py-2 text-sm font-medium text-balance',
				search?.category === category.id
					? 'border-blue-600 bg-blue-50 text-blue-800'
					: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
			]}
			onclick={() => searchNearby(category.id)}
		>
			{category.label}
		</button>
	{/each}
{/if}

{#if showSearch && search}
	<section
		class="w-full basis-full space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
		aria-label="近くの施設を検索"
	>
		<div class="flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold">
				{search.category === 'toilet' ? 'トイレを探す' : 'ゴミ箱を探す'}
			</h3>
			<button
				type="button"
				class="min-h-9 rounded-md px-2 text-xs text-slate-600 hover:bg-slate-200"
				onclick={() => navigation.clearFacilitySearch()}>検索を閉じる</button
			>
		</div>
		{#if search.category === 'toilet'}
			<div class="space-y-1">
				<label for={`${uid}-type`} class="text-xs font-medium">トイレの種類</label>
				<select
					id={`${uid}-type`}
					class="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
					value={search.toiletType ?? ''}
					onchange={(event) =>
						navigation.searchFacilities(
							'toilet',
							(event.currentTarget.value || undefined) as ToiletType | undefined
						)}
				>
					<option value="">指定なし</option>
					<option value="men">男子</option>
					<option value="women">女子</option>
					<option value="accessible">バリアフリー</option>
				</select>
			</div>
		{/if}
		{#if gps.enabled}
			<p role="status" class="text-xs text-slate-600">
				{gps.position
					? '現在地から直線距離で近い順に、最大5件を表示しています。'
					: '現在地を取得中です。'}
			</p>
		{:else}
			<div class="space-y-1">
				<label for={`${uid}-building`} class="text-xs font-medium">現在の建物</label>
				<select
					id={`${uid}-building`}
					class="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
					value={search.buildingId ?? ''}
					onchange={(event) => navigation.setFacilityBuilding(event.currentTarget.value)}
				>
					<option value="">建物を選択してください</option>
					{#each navigation.facilityBuildings as building (building.id)}
						<option value={building.id}>{building.name}</option>
					{/each}
				</select>
			</div>
		{/if}
		{#if ready}
			{#if results.length}
				<ul
					class="max-h-52 divide-y divide-slate-200 overflow-y-auto rounded-lg bg-white"
					aria-label="近くの施設の検索結果"
				>
					{#each results as marker (marker.id)}
						<li>
							<button
								type="button"
								class="flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left hover:bg-blue-50"
								onclick={() => onselect(marker.id)}
							>
								<img src={marker.icon} alt="" class="size-6 shrink-0 object-contain" />
								<span class="min-w-0">
									<span class="block text-sm font-medium"
										>{singleLineDestinationName(marker.name)}</span
									>
									<span class="block text-xs text-slate-500"
										>{marker.buildingId === 'outdoor'
											? '屋外'
											: `${buildingNames[marker.buildingId] ?? marker.buildingId} · ${formatFloorLabel(marker.buildingId, marker.floor, false)}`}</span
									>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p role="status" class="text-sm text-slate-600">
					条件に合う{search.category === 'toilet' ? 'トイレ' : 'ゴミ箱'}がありません。
				</p>
			{/if}
		{/if}
	</section>
{/if}
