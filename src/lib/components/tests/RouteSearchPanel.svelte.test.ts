import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import RouteSearchPanel from '../layout/RouteSearchPanel.svelte';
import { createNavigationState } from '../../states/navigation.svelte';

afterEach(() => vi.restoreAllMocks());

describe('RouteSearchPanel', () => {
	it('出発地に2I-HRを表示し、行き先を選ぶだけで検索できる', async () => {
		const navigation = createNavigationState();
		const { container, getByRole } = await render(RouteSearchPanel, { navigation, snap: 'middle' });
		expect(container.querySelector<HTMLInputElement>('input[aria-label="出発地"]')?.value).toBe(
			'HR教室:2I'
		);
		await getByRole('combobox', { name: '行き先', exact: true }).fill('HR教室:1-1');
		await userEvent.keyboard('{Enter}');
		await getByRole('button', { name: 'ルート検索', exact: true }).click();
		expect(navigation.routePath?.[0]).toBe('node_la_f2_hr_2i');
		expect(navigation.routePath?.at(-1)).toBe('node_la_f1_hr_1-1');
	});

	it('経路がないときはエラーを表示し、シートを閉じたり施設情報を開いても表示を保つ', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const base = createNavigationState();
		const navigation = createNavigationState({
			graph: { nodes: base.graph.nodes, edges: [] },
			pois: base.pois
		});
		navigation.setHighlight('poi_hr_1-1', 'goal');
		const { container, getByRole, rerender } = await render(RouteSearchPanel, {
			navigation,
			snap: 'middle'
		});
		await getByRole('button', { name: 'ルート検索', exact: true }).click();
		expect(navigation.routePath).toBeNull();
		await expect
			.poll(() => container.querySelector('[role="alert"]')?.textContent)
			.toContain('選択した場所を結ぶ経路が見つかりません。');
		await rerender({ navigation, snap: 'bottom' });
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		navigation.setHighlight('poi_hr_1-1');
		await expect
			.poll(() => container.querySelector('[aria-label="選択した施設の情報"]'))
			.not.toBeNull();
		expect(container.querySelector('[role="alert"]')).not.toBeNull();
		navigation.clearRoute();
		await expect.poll(() => container.querySelector('[role="alert"]')).toBeNull();
	});

	it.each([true, false])(
		'バリアフリーの切り替えで経路を再検索し、迂回路の有無を表示する (%s)',
		async (hasDetour) => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const base = createNavigationState();
			const from = base.resolvePoi('poi_hr_1-1')!.node;
			const to = base.resolvePoi('poi_hr_2m')!.node;
			const detour = { ...from, id: 'accessible-detour', x: from.x + 10 };
			const navigation = createNavigationState({
				pois: base.pois,
				graph: {
					nodes: [from, to, detour],
					edges: [
						{ id: 'stairs', fromNode: from.id, toNode: to.id, isStairs: true, weight: 1 },
						...(hasDetour
							? [
									{
										id: 'detour-start',
										fromNode: from.id,
										toNode: detour.id,
										isStairs: false,
										weight: 10
									},
									{
										id: 'detour-goal',
										fromNode: detour.id,
										toNode: to.id,
										isStairs: false,
										weight: 10
									}
								]
							: [])
					]
				}
			});
			navigation.setHighlight('poi_hr_1-1', 'start');
			navigation.setHighlight('poi_hr_2m', 'goal');
			const { container, getByRole, getByText } = await render(RouteSearchPanel, {
				navigation,
				snap: 'middle'
			});
			await getByRole('button', { name: 'ルート検索', exact: true }).click();
			await getByText('オプション', { exact: true }).click();
			expect(navigation.routePath).toEqual([from.id, to.id]);
			await getByRole('switch', { name: 'バリアフリー' }).click();
			expect(container.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
			if (hasDetour) {
				expect(navigation.routePath).toEqual([from.id, detour.id, to.id]);
			} else {
				expect(navigation.routePath).toBeNull();
				await expect
					.poll(() => container.querySelector('[role="alert"]')?.textContent)
					.toContain('階段を使わない経路が見つかりません');
			}
			await getByRole('switch', { name: 'バリアフリー' }).click();
			expect(navigation.routePath).toEqual([from.id, to.id]);
		}
	);
	it('下段は行き先のみ表示し、入力時に中段へ展開して入力とフォーカスを維持する', async () => {
		const navigation = createNavigationState();
		const { container, getByRole } = await render(RouteSearchPanel, { navigation });
		const start = container.querySelector<HTMLInputElement>('input[aria-label="出発地"]')!;
		const goal = container.querySelector<HTMLInputElement>('input[aria-label="行き先"]')!;
		expect(start.closest('.hidden')).not.toBeNull();
		expect(container.querySelector('button[type="submit"]')).toBeNull();
		await getByRole('combobox', { name: '行き先', exact: true }).fill('1-1');
		await expect.poll(() => start.closest('.hidden')).toBeNull();
		expect(goal.value).toBe('1-1');
		expect(document.activeElement).toBe(goal);
		expect(container.querySelector('button[type="submit"]')).not.toBeNull();
	});

	it('検索候補を選んで経路を表示し、入力を変更すると古い経路と選択を解除する', async () => {
		const navigation = createNavigationState();
		const { container, getByRole } = await render(RouteSearchPanel, { navigation });
		await getByRole('combobox', { name: '行き先', exact: true }).fill('HR教室:1-1');
		await userEvent.keyboard('{Enter}');
		expect(navigation.highlights.goal).toBe('poi_hr_1-1');
		expect(navigation.focusRequest?.poiId).toBe('poi_hr_1-1');
		expect(navigation.focusRequest?.showFloor).toBe(true);
		await getByRole('combobox', { name: '出発地', exact: true }).fill('HR教室:1-2');
		await getByRole('button', { name: 'HR教室:1-2', exact: true }).click();
		expect(navigation.focusRequest?.showFloor).toBe(false);
		await getByRole('button', { name: 'ルート検索', exact: true }).click();
		expect(navigation.routePath?.[0]).toBe('node_la_f1_hr_1-2');
		expect(navigation.routePath?.at(-1)).toBe('node_la_f1_hr_1-1');
		await getByRole('combobox', { name: '行き先', exact: true }).fill('存在しない部屋zzzz');
		expect(navigation.highlights.goal).toBeUndefined();
		expect(navigation.routePath).toBeNull();
		expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(
			true
		);
		await expect.poll(() => container.textContent).toContain('一致する場所がありません。');
	});

	it('POI選択時は下段にタイトル、中段に短い説明、上段に全文を表示する', async () => {
		const base = createNavigationState();
		const description =
			'施設の説明です。\n利用できる設備と利用方法を案内します。\n入口は廊下側にあります。';
		const navigation = createNavigationState({
			graph: base.graph,
			pois: base.pois.map((poi) => (poi.id === 'poi_hr_1-1' ? { ...poi, description } : poi))
		});
		navigation.setHighlight('poi_hr_1-1');
		const { container, getByRole, rerender } = await render(RouteSearchPanel, { navigation });
		expect(container.textContent).toContain('HR教室:1-1');
		expect(container.querySelector('.poi-description')).toBeNull();
		expect(container.querySelector('input')).toBeNull();
		expect(container.querySelector('button')?.textContent).toContain('HR教室:1-1');
		expect(getByRole('button', { name: 'ここへ行く', exact: true })).toBeDefined();
		expect(getByRole('button', { name: '出発地にする', exact: true })).toBeDefined();
		await getByRole('button', { name: 'HR教室:1-1の詳細を表示' }).click();
		const paragraph = container.querySelector<HTMLElement>('.poi-description')!;
		expect(paragraph.textContent).toContain(description);
		expect(getComputedStyle(paragraph).webkitLineClamp).toBe('2');
		await rerender({ navigation, snap: 'top' });
		expect(getComputedStyle(paragraph).webkitLineClamp).toBe('none');
		await getByRole('button', { name: 'ここへ行く', exact: true }).click();
		expect(navigation.highlights.goal).toBe('poi_hr_1-1');
		expect(navigation.selectedPoi).toBeNull();
		await expect
			.poll(() => container.querySelector<HTMLInputElement>('input[aria-label="行き先"]')?.value)
			.toBe('HR教室:1-1');
	});

	it.each(['ここへ行く', '出発地にする'])(
		'下段の「%s」から選択施設を設定できる',
		async (action) => {
			const navigation = createNavigationState();
			navigation.setHighlight('poi_hr_1-1');
			const { getByRole } = await render(RouteSearchPanel, { navigation });
			await getByRole('button', { name: action, exact: true }).click();
			expect(navigation.highlights[action === 'ここへ行く' ? 'goal' : 'start']).toBe('poi_hr_1-1');
			expect(navigation.selectedPoi).toBeNull();
		}
	);
});
