<script lang="ts">
	import { tick } from 'svelte';
	import type { NavigationState } from '#lib';
	let {
		navigation,
		focusOnPoi
	}: {
		navigation: NavigationState;
		focusOnPoi: (poiId: string) => void;
	} = $props();

	async function navigate(start: string, goal: string) {
		const startNode = navigation.resolvePoi(start)?.node;
		const goalNode = navigation.resolvePoi(goal)?.node;
		if (!startNode || !goalNode) {
			console.error(`経路の始点または終点が見つかりません: ${start} -> ${goal}`);
			return;
		}
		navigation.showRoute(startNode.id, goalNode.id);
		navigation.setHighlight(start, 'start');
		navigation.setHighlight(goal, 'goal');
		await tick();
		focusOnPoi(start);
	}
</script>

<div class="pb-20">
	<button type="button" onclick={() => focusOnPoi('poi_lr-chem')}>化学講義室へ移動</button>
	<button type="button" onclick={() => focusOnPoi('poi_hr_1-1')}>1-1HRへ移動</button>
	<button type="button" onclick={() => navigate('poi_hr_1-1', 'poi_lab-a-phys')}>
		1-1HRから応用物理実験室への経路を表示
	</button>
	<button type="button" onclick={() => navigate('poi_main-gate', 'poi_student-association-office')}>
		正門から執行部室への経路を表示
	</button>
	<button type="button" onclick={() => navigation.setHighlight('poi_hr_1-1', 'start')}>
		1-1HRをスタート色でハイライト
	</button>
	<button type="button" onclick={() => navigation.setHighlight('poi_lab-a-phys', 'goal')}>
		応用物理実験室をゴール色でハイライト
	</button>
	<button type="button" onclick={() => navigation.setHighlight('poi_lr-chem', 'selected')}>
		化学講義室を選択色でハイライト
	</button>
	<button type="button" onclick={() => navigation.clearHighlight()}>POIハイライトを解除</button>
</div>

<style>
	button {
		margin-top: 4px;
		padding: 4px;
		border: solid 1px black;
	}
</style>
