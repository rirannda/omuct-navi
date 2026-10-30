import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import type { MapMarker } from '../../../data/types';
import Map from '../Map.svelte';
import { createNavigationState } from '../../states/navigation.svelte';

const { markerData } = vi.hoisted(() => ({
	markerData: [
		{
			id: 'marker-courtyard',
			name: '中庭のごみ箱',
			categoryId: 'trash',
			nodeId: 'node_outdoor_f0_main-gate',
			description: '分別して捨ててください。',
			keys: ['ごみすてば'],
			icon: '',
			buildingId: 'outdoor',
			floor: 0,
			x: 700,
			y: 800
		},
		{
			id: 'marker-admin',
			name: '管理棟のトイレ',
			categoryId: 'toilet',
			nodeId: 'node_outdoor_f0_main-gate',
			description: '2階、階段の右側です。経路は正門まで案内します。',
			icon: '',
			buildingId: 'admin',
			floor: 2,
			x: 500,
			y: 800
		}
	] satisfies MapMarker[]
}));

vi.mock('../../../data/markers', async () => {
	markerData[0].icon = (await import('../../assets/markers/trash.svg')).default;
	markerData[1].icon = (await import('../../assets/markers/toilet-accessible.svg')).default;
	return { markers: markerData };
});

afterEach(() => vi.restoreAllMocks());

async function setup() {
	vi.spyOn(globalThis, 'fetch').mockImplementation(
		async () =>
			new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1700"></svg>')
	);
	const navigation = createNavigationState();
	const rendered = await render(Map, { navigation });
	await expect.poll(() => rendered.container.querySelector('.facility-marker')).not.toBeNull();
	return { ...rendered, navigation };
}

describe('Map marker integration', () => {
	it('markers.tsを読み込み、SVGのない地点をタッチして詳細と目的地を設定する', async () => {
		const { container, getByRole, navigation } = await setup();
		expect(container.querySelectorAll('.facility-marker')).toHaveLength(2);
		await getByRole('button', { name: '中庭のごみ箱', exact: true }).click();
		expect(navigation.selectedPoi?.id).toBe('marker-courtyard');
		await expect
			.poll(() => container.querySelector('.route-search-panel')?.textContent)
			.toContain('中庭のごみ箱');
		expect(container.querySelector('.route-search-panel')?.textContent).toContain('屋外');
		expect(
			container.querySelector('.facility-marker-highlight')?.getAttribute('data-marker-id')
		).toBe('marker-courtyard');
		await getByRole('button', { name: 'ここへ行く', exact: true }).click();
		expect(navigation.highlights.goal).toBe('marker-courtyard');
		expect(navigation.selectedPoi).toBeNull();
		expect(container.querySelector<HTMLInputElement>('input[aria-label="行き先"]')?.value).toBe(
			'中庭のごみ箱'
		);
	});

	it('詳細図がない建物でも所属階を表示し、到達ノードとは別の位置へ移動する', async () => {
		const { component, container, getByRole, navigation } = await setup();
		component.focusOnPoiId('marker-admin');
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim'), {
				timeout: 3000
			})
			.toBeNull();
		await getByRole('button', { name: '管理棟のトイレ', exact: true }).click();
		expect(navigation.selectedPoi?.id).toBe('marker-admin');
		await expect
			.poll(() => container.querySelector('.route-search-panel')?.textContent)
			.toContain('管理棟 · 2階');
		expect(navigation.resolvePoi('marker-admin')?.node.floor).toBe(0);
		expect(navigation.resolvePoi('marker-admin')?.location.floor).toBe(2);
		expect(container.querySelector('.building-controls')).toBeNull();
	});

	it('マーカーの検索語で候補を選び、既存の出発地から到達ノードへ経路を検索する', async () => {
		const { container, getByRole, navigation } = await setup();
		await getByRole('combobox', { name: '行き先', exact: true }).fill('ごみすてば');
		await userEvent.keyboard('{Enter}');
		expect(navigation.highlights.goal).toBe('marker-courtyard');
		await getByRole('button', { name: 'ルート検索', exact: true }).click();
		expect(navigation.routePath?.[0]).toBe('node_la_f2_hr_2i');
		expect(navigation.routePath?.at(-1)).toBe('node_outdoor_f0_main-gate');
		await expect.poll(() => container.querySelector('.route-endpoint-marker')).not.toBeNull();
	});
});
