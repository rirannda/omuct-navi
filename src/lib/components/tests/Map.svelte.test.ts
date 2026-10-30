import { page } from 'vitest/browser';
import { tapBuilding } from './mapTestHelpers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Map from '../Map.svelte';
import { createNavigationState } from '../../states/navigation.svelte';
import { flushSync } from 'svelte';

function svgForUrl(url: string): string {
	const contents = url.endsWith('la-bldg_F1.svg')
		? '<path id="hr_1-1" d="M514.5 1151h33v31.5h-33z" style="fill: #eeeeee; stroke: black" /><g id="hr_1-2"><path id="hr_1-2-shape" d="M481.5 1151h33v31.5h-33z" fill="none" stroke="black" /></g><path id="hr_1-3" d="M414.5 1151h33.5v31.5h-33.5z" fill="none" stroke="black" /><path id="hr_1-4" d="M381 1151h33.5v31.5H381z" fill="none" stroke="black" />'
		: url.endsWith('la-bldg_F3.svg')
			? '<g id="lab-a-phys" transform="translate(10, 5)"><rect id="lab-a-phys-shape" x="535.5" y="1027.5" width="45.5" height="36" /></g>'
			: '<rect id="hr_1-1" x="0" y="0" width="10" height="10" />';
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1700">${contents}</svg>`;
}

function mockMaps(ready: Promise<void> = Promise.resolve()) {
	const fetchMap = globalThis.fetch.bind(globalThis);
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		await ready;
		// 正門は実際のSVGを使い、POIとのIDの不一致も検出します。
		if (['master.svg', 'main-gate.svg'].some((file) => String(input).endsWith(file)))
			return fetchMap(input);
		return new Response(svgForUrl(String(input)), { headers: { 'Content-Type': 'image/svg+xml' } });
	});
}

async function renderMap() {
	const navigation = createNavigationState();
	const rendered = await render(Map, { props: { navigation } });
	return { ...rendered, navigation };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Map POI selection', () => {
	it('正門のSVGをタップやキーボードで選択し、部屋と同じ選択枠でハイライトする', async () => {
		mockMaps();
		const { component, container, getByRole, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('#main-gate.poi-selectable')).not.toBeNull();
		component.focusOnPoiId('poi_main-gate');
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim'), {
				timeout: 3000
			})
			.toBeNull();
		const mapTransform = container.querySelector<HTMLElement>('.leaflet-map-pane')!.style.transform;
		await getByRole('button', { name: '正門', exact: true }).click();
		expect(navigation.selectedPoi?.id).toBe('poi_main-gate');
		expect(navigation.selectedPoi?.nodeId).toBe('node_outdoor_f0_main-gate');
		expect(container.querySelector('.poi-highlight')?.id).toBe('main-gate');
		expect(getComputedStyle(container.querySelector('#main-gate_2')!).fill).toBe(
			'rgb(251, 191, 36)'
		);
		expect(container.querySelector('.poi-name-tooltip')?.textContent).toBe('正門');
		expect(container.querySelector<HTMLElement>('.leaflet-map-pane')!.style.transform).toBe(
			mapTransform
		);
		flushSync(() => navigation.clearHighlight('selected'));
		expect(navigation.selectedPoi).toBeNull();
		container
			.querySelector('#main-gate')!
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(navigation.selectedPoi?.id).toBe('poi_main-gate');
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1'))).toBe(true);
		expect(container.querySelector('#main-gate')!.classList.contains('poi-highlight')).toBe(false);
		expect(navigation.selectedPoi?.id).toBe('poi_hr_1-1');
		expect(flushSync(() => navigation.setHighlight('poi_main-gate', 'goal'))).toBe(true);
		expect(navigation.selectedPoi?.id).toBe('poi_hr_1-1');
		expect(container.querySelector('#main-gate')!.classList.contains('poi-color-goal')).toBe(true);
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		await expect.poll(() => container.querySelectorAll('.poi-highlight').length).toBe(2);
	});

	it.each([390, 1280])(
		'POIを選んでもシートを下段に保ち、操作ボタンを見切れず表示する (%s)',
		async (width) => {
			await page.viewport(width, 844);
			mockMaps();
			const { component, container, getByRole } = await renderMap();
			await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
			component.focusOnPoiId('poi_hr_1-1');
			await tapBuilding(container, 'la');
			await expect
				.poll(() => container.querySelector('.leaflet-zoom-anim'), { timeout: 3000 })
				.toBeNull();
			await getByRole('button', { name: 'HR教室:1-1', exact: true }).click();
			const sheet = container.querySelector<HTMLElement>('.bottom-sheet')!;
			expect(sheet.dataset.snap).toBe('bottom');
			expect(sheet.getBoundingClientRect().height).toBe(144);
			for (const action of ['ここへ行く', '出発地にする']) {
				const button = Array.from(sheet.querySelectorAll('button')).find(
					(button) => button.textContent?.trim() === action
				)!;
				expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(
					sheet.getBoundingClientRect().bottom
				);
				expect(button.getBoundingClientRect().top).toBeGreaterThan(
					sheet.getBoundingClientRect().top
				);
			}
			const content = container.querySelector<HTMLElement>('.sheet-content')!;
			expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight);
		}
	);

	it('図形の内部やグループの子要素からPOIを選択し、親へ選択結果を渡す', async () => {
		mockMaps();
		const { component, container, getByRole, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		await expect
			.poll(() => container.querySelector('.poi-selectable'), { timeout: 3000 })
			.not.toBeNull();
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim'), {
				timeout: 3000
			})
			.toBeNull();
		const mapTransform = container.querySelector<HTMLElement>('.leaflet-map-pane')!.style.transform;
		await getByRole('button', { name: 'HR教室:1-1', exact: true }).click();
		expect(navigation.selectedPoi?.id).toBe('poi_hr_1-1');
		expect(navigation.selectedPoi?.nodeId).toBe('node_la_f1_hr_1-1');
		expect(container.querySelector('.poi-highlight')?.id).toBe('hr_1-1');
		expect(container.querySelector<HTMLElement>('.leaflet-map-pane')!.style.transform).toBe(
			mapTransform
		);
		const firstRoom = container.querySelector('.poi-highlight')!;
		await getByRole('button', { name: 'HR教室:1-2', exact: true }).click();
		expect(navigation.selectedPoi?.id).toBe('poi_hr_1-2');
		expect(container.querySelector('.poi-highlight')?.id).toBe('hr_1-2');
		expect(firstRoom.classList.contains('poi-highlight')).toBe(false);
		expect(getComputedStyle(container.querySelector('.poi-highlight')!).fill).toBe(
			'rgb(251, 191, 36)'
		);
		flushSync(() => navigation.clearHighlight());
		expect(navigation.selectedPoi).toBeNull();
		expect(container.querySelector('.poi-highlight')).toBeNull();
	});

	it('別の階の同名のSVGでは選択せず、表示中の階のPOIだけを選ぶ', async () => {
		mockMaps();
		const { component, container, getByRole, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1'))).toBe(true);
		await expect
			.poll(
				() =>
					container
						.querySelector('[data-building="la"] .floor-buttons button.active')
						?.textContent?.trim(),
				{
					timeout: 3000
				}
			)
			.toBe('1F');
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '2F', exact: true })
			.click();
		const shapes = container.querySelectorAll('.leaflet-floor-maps-pane #hr_1-1');
		expect(shapes.length).toBeGreaterThan(0);
		for (const shape of shapes) shape.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(navigation.selectedPoi?.id).toBe('poi_hr_1-1');
		expect(container.querySelector('.poi-highlight')).toBeNull();
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '3F', exact: true })
			.click();
		component.focusOnPoiId('poi_lab-a-phys');
		await tapBuilding(container, 'la');
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim'), {
				timeout: 3000
			})
			.toBeNull();
		await getByRole('button', { name: '応用物理実験室', exact: true }).click();
		expect(navigation.selectedPoi?.id).toBe('poi_lab-a-phys');
		expect(navigation.selectedPoi?.svgId).toBe('lab-a-phys');
		expect(container.querySelector('.poi-highlight')?.id).toBe('lab-a-phys');
	});
});

describe('Map POI highlight', () => {
	it('スタート・ゴール・選択の3部屋を保持し、タップでは選択枠だけを置き換える', async () => {
		mockMaps();
		const { component, container, getByRole, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-3');
		await tapBuilding(container, 'la');
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', 'start'))).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-2', 'goal'))).toBe(true);
		expect(navigation.selectedPoi).toBeNull();
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-3', 'selected'))).toBe(true);
		await expect.poll(() => container.querySelectorAll('.poi-highlight').length).toBe(3);
		expect(getComputedStyle(container.querySelector('#hr_1-1.poi-selectable')!).fill).toBe(
			'rgb(34, 197, 94)'
		);
		expect(getComputedStyle(container.querySelector('#hr_1-2')!).fill).toBe('rgb(239, 68, 68)');
		expect(getComputedStyle(container.querySelector('#hr_1-3')!).fill).toBe('rgb(251, 191, 36)');
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim'), {
				timeout: 3000
			})
			.toBeNull();
		await getByRole('button', { name: 'HR教室:1-4', exact: true }).click();
		expect(navigation.selectedPoi?.id).toBe('poi_hr_1-4');
		expect(container.querySelector('#hr_1-3')!.classList.contains('poi-highlight')).toBe(false);
		expect(container.querySelectorAll('.poi-highlight').length).toBe(3);
		expect(container.querySelectorAll('.poi-highlight.poi-color-selected').length).toBe(1);
		expect(
			container.querySelector('#hr_1-1.poi-selectable')!.classList.contains('poi-color-start')
		).toBe(true);
		expect(container.querySelector('#hr_1-2')!.classList.contains('poi-color-goal')).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-3', 'goal'))).toBe(true);
		expect(navigation.selectedPoi?.id).toBe('poi_hr_1-4');
		expect(container.querySelector('#hr_1-2')!.classList.contains('poi-highlight')).toBe(false);
		expect(container.querySelectorAll('.poi-highlight').length).toBe(3);
		flushSync(() => navigation.clearHighlight('selected'));
		expect(navigation.selectedPoi).toBeNull();
		expect(container.querySelectorAll('.poi-highlight').length).toBe(2);
		flushSync(() => navigation.clearHighlight());
		expect(container.querySelector('.poi-highlight')).toBeNull();
	});

	it('同じ部屋の複数の役割は1つの表示にまとめ、解除した役割だけを外す', async () => {
		mockMaps();
		const { component, container, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', 'start'))).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', 'goal'))).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', 'selected'))).toBe(true);
		await expect.poll(() => container.querySelectorAll('.poi-highlight').length).toBe(1);
		expect(container.querySelectorAll('.poi-name-tooltip').length).toBe(1);
		expect(getComputedStyle(container.querySelector('.poi-highlight')!).fill).toBe(
			'rgb(251, 191, 36)'
		);
		flushSync(() => navigation.clearHighlight('selected'));
		expect(getComputedStyle(container.querySelector('.poi-highlight')!).fill).toBe(
			'rgb(239, 68, 68)'
		);
		flushSync(() => navigation.clearHighlight('goal'));
		expect(getComputedStyle(container.querySelector('.poi-highlight')!).fill).toBe(
			'rgb(34, 197, 94)'
		);
		flushSync(() => navigation.clearHighlight('start'));
		expect(container.querySelector('.poi-highlight')).toBeNull();
	});

	it('初期化前でも各役割に1部屋だけ予約し、最新の選択を含む3部屋まで表示する', async () => {
		let finishLoading!: () => void;
		mockMaps(
			new Promise<void>((resolve) => {
				finishLoading = resolve;
			})
		);
		const { component, container, navigation } = await renderMap();
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', 'start'))).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-2', 'goal'))).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-3', 'selected'))).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-4', 'selected'))).toBe(true);
		expect(container.querySelector('.poi-highlight')).toBeNull();
		finishLoading();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-4');
		await tapBuilding(container, 'la');
		await expect.poll(() => container.querySelectorAll('.poi-highlight').length).toBe(3);
		expect(
			container.querySelector('#hr_1-1.poi-selectable')!.classList.contains('poi-color-start')
		).toBe(true);
		expect(container.querySelector('#hr_1-2')!.classList.contains('poi-color-goal')).toBe(true);
		expect(container.querySelector('#hr_1-3')!.classList.contains('poi-highlight')).toBe(false);
		expect(container.querySelector('#hr_1-4')!.classList.contains('poi-color-selected')).toBe(true);
	});

	it('同じPOIを3種類の色名で切り替えられ、省略すると選択色に戻る', async () => {
		mockMaps();
		const { component, container, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		for (const [color, expected] of [
			['start', 'rgb(34, 197, 94)'],
			['goal', 'rgb(239, 68, 68)'],
			['selected', 'rgb(251, 191, 36)']
		] as const) {
			expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', color))).toBe(true);
			await expect.poll(() => container.querySelector('.poi-highlight')).not.toBeNull();
			expect(getComputedStyle(container.querySelector('.poi-highlight')!).fill).toBe(expected);
			expect(container.querySelectorAll('.poi-highlight').length).toBe(1);
		}
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', 'goal'))).toBe(true);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1'))).toBe(true);
		expect(getComputedStyle(container.querySelector('.poi-highlight')!).fill).toBe(
			'rgb(251, 191, 36)'
		);
	});

	it('対応する階のSVGだけを強調し、図形の中心に名前を表示し、解除すると元に戻す', async () => {
		mockMaps();
		const { component, container, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1'))).toBe(true);
		await expect.poll(() => container.querySelectorAll('.poi-highlight').length).toBe(1);
		const firstRoom = container.querySelector<SVGGraphicsElement>('.poi-highlight')!;
		const originalStyle = firstRoom.getAttribute('style');
		expect(firstRoom.id).toBe('hr_1-1');
		expect(getComputedStyle(firstRoom).fill).toBe('rgb(251, 191, 36)');
		expect(getComputedStyle(firstRoom).stroke).toBe('rgb(180, 83, 9)');
		expect(container.querySelector('.poi-name-tooltip')?.textContent).toBe('HR教室:1-1');

		expect(flushSync(() => navigation.setHighlight('poi_lab-a-phys'))).toBe(true);
		component.focusOnPoiId('poi_lab-a-phys');
		await tapBuilding(container, 'la');
		expect(firstRoom.classList.contains('poi-highlight')).toBe(false);
		await expect
			.poll(
				() =>
					container
						.querySelector('[data-building="la"] .floor-buttons button.active')
						?.textContent?.trim(),
				{
					timeout: 3000
				}
			)
			.toBe('3F');
		await expect.poll(() => container.querySelectorAll('.poi-name-tooltip').length).toBe(1);
		await expect
			.poll(() => container.querySelector('.leaflet-zoom-anim, .leaflet-pan-anim'), {
				timeout: 3000
			})
			.toBeNull();
		expect(container.querySelector('.poi-highlight')?.id).toBe('lab-a-phys');
		expect(container.querySelector('.poi-name-tooltip')?.textContent).toBe('応用物理実験室');
		const roomBounds = container.querySelector('.poi-highlight')!.getBoundingClientRect();
		const tooltipBounds = container.querySelector('.poi-name-tooltip')!.getBoundingClientRect();
		expect(tooltipBounds.width).toBeGreaterThan(tooltipBounds.height);
		expect(
			Math.abs(tooltipBounds.x + tooltipBounds.width / 2 - (roomBounds.x + roomBounds.width / 2))
		).toBeLessThan(2);
		expect(
			// 指定した8pxのオフセットと、Leafletの吹き出し先端の6px分を含みます。
			Math.abs(tooltipBounds.bottom + 14 - (roomBounds.y + roomBounds.height / 2))
		).toBeLessThan(2);

		flushSync(() => navigation.clearHighlight());
		expect(container.querySelector('.poi-highlight')).toBeNull();
		await expect.poll(() => container.querySelector('.poi-name-tooltip')).toBeNull();
		expect(firstRoom.getAttribute('style')).toBe(originalStyle);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1'))).toBe(true);
		flushSync(() => navigation.clearHighlight());
		expect(getComputedStyle(firstRoom).fill).toBe('rgb(238, 238, 238)');
	});

	it('不明なPOIや不正な役割を指定しても、現在のハイライトを失わない', async () => {
		mockMaps();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { component, container, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1'))).toBe(true);
		await expect.poll(() => container.querySelector('.poi-highlight')?.id).toBe('hr_1-1');
		expect(flushSync(() => navigation.setHighlight('missing'))).toBe(false);
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1', 'unknown' as never))).toBe(false);
		expect(container.querySelector('.poi-highlight')?.id).toBe('hr_1-1');
		expect(container.querySelectorAll('.poi-highlight').length).toBe(1);
	});

	it('SVGの読み込み前の呼び出しを予約し、別の階では吹き出しを隠す', async () => {
		let finishLoading!: () => void;
		mockMaps(
			new Promise<void>((resolve) => {
				finishLoading = resolve;
			})
		);
		const { component, container, getByRole, navigation } = await renderMap();
		expect(flushSync(() => navigation.setHighlight('poi_lab-a-phys', 'goal'))).toBe(true);
		expect(container.querySelector('.poi-highlight')).toBeNull();
		finishLoading();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_lab-a-phys');
		await tapBuilding(container, 'la');
		await expect.poll(() => container.querySelector('.poi-highlight')?.id).toBe('lab-a-phys');
		expect(getComputedStyle(container.querySelector('.poi-highlight')!).fill).toBe(
			'rgb(239, 68, 68)'
		);
		await expect
			.poll(
				() =>
					container
						.querySelector('[data-building="la"] .floor-buttons button.active')
						?.textContent?.trim(),
				{
					timeout: 3000
				}
			)
			.toBe('3F');
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '1F', exact: true })
			.click();
		await expect.poll(() => container.querySelector('.poi-name-tooltip')).toBeNull();
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '3F', exact: true })
			.click();
		await expect
			.poll(() => container.querySelector('.poi-name-tooltip')?.textContent)
			.toBe('応用物理実験室');
	});

	it('初期化前に解除したハイライトを、SVG読み込み後に再表示しない', async () => {
		let finishLoading!: () => void;
		mockMaps(
			new Promise<void>((resolve) => {
				finishLoading = resolve;
			})
		);
		const { component, container, navigation } = await renderMap();
		expect(flushSync(() => navigation.setHighlight('poi_hr_1-1'))).toBe(true);
		flushSync(() => navigation.clearHighlight());
		finishLoading();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		component.focusOnPoiId('poi_hr_1-1');
		await tapBuilding(container, 'la');
		expect(container.querySelector('.poi-highlight')).toBeNull();
		expect(container.querySelector('.poi-name-tooltip')).toBeNull();
	});
});

describe('Map route endpoints', () => {
	it('始点と終点をそれぞれの階に表示し、再描画や解除で古いマークを残さない', async () => {
		mockMaps();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { container, getByRole, navigation } = await renderMap();
		await expect.poll(() => container.querySelector('.leaflet-overlay-pane svg')).not.toBeNull();
		expect(
			flushSync(() => navigation.showRoute('node_la_f1_hr_1-1', 'node_la_f3_lab-a-phys'))
		).not.toBeNull();
		await tapBuilding(container, 'la');
		expect(container.querySelectorAll('.route-endpoint-start').length).toBe(1);
		expect(container.querySelector('.route-endpoint-start')?.textContent).toBe('S');
		expect(
			getComputedStyle(container.querySelector('.route-endpoint-start .route-endpoint-symbol')!)
				.backgroundColor
		).toBe('rgb(21, 128, 61)');
		await expect
			.poll(
				() =>
					container
						.querySelector('[data-building="la"] .floor-buttons button.active')
						?.textContent?.trim(),
				{
					timeout: 3000
				}
			)
			.toBe('1F');
		expect(container.querySelector('.route-endpoint-goal')).toBeNull();
		await getByRole('region', { name: '教養棟の階' })
			.getByRole('button', { name: '3F', exact: true })
			.click();
		expect(container.querySelector('.route-endpoint-start')).toBeNull();
		expect(container.querySelectorAll('.route-endpoint-goal').length).toBe(1);
		expect(container.querySelector('.route-endpoint-goal svg')).not.toBeNull();
		expect(
			getComputedStyle(container.querySelector('.route-endpoint-goal .route-endpoint-symbol')!)
				.backgroundColor
		).toBe('rgb(185, 28, 28)');

		expect(
			flushSync(() => navigation.showRoute('node_la_f1_hr_1-1', 'node_la_f1_hr_1-2'))
		).not.toBeNull();
		expect(container.querySelectorAll('.route-endpoint-marker').length).toBe(2);
		flushSync(() => navigation.clearRoute());
		expect(container.querySelector('.route-endpoint-marker')).toBeNull();
		await expect.poll(() => container.querySelector('.route-endpoint-label')).toBeNull();
		expect(flushSync(() => navigation.showRoute('node_la_f1_hr_1-1', 'node_la_f1_hr_1-1'))).toEqual(
			['node_la_f1_hr_1-1']
		);
		expect(container.querySelectorAll('.route-endpoint-marker').length).toBe(1);
		expect(container.querySelector('.route-endpoint-start-goal')?.textContent).toBe('S/G');
		expect(flushSync(() => navigation.showRoute('missing', 'node_la_f1_hr_1-1'))).toBeNull();
		expect(container.querySelector('.route-endpoint-marker')).toBeNull();
	});

	it('地図の読み込み前に指定した経路にも始点・終点を表示する', async () => {
		let finishLoading!: () => void;
		mockMaps(
			new Promise<void>((resolve) => {
				finishLoading = resolve;
			})
		);
		const { container, navigation } = await renderMap();
		expect(
			flushSync(() => navigation.showRoute('node_la_f1_hr_1-1', 'node_la_f1_hr_1-2'))
		).not.toBeNull();
		expect(container.querySelector('.route-endpoint-marker')).toBeNull();
		finishLoading();
		await expect.poll(() => container.querySelectorAll('.route-endpoint-marker').length).toBe(2);
		expect(container.querySelector('.route-endpoint-start')).not.toBeNull();
		expect(container.querySelector('.route-endpoint-goal')).not.toBeNull();
	});
});
