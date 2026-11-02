import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type * as L from 'leaflet';
import Map from '../Map.svelte';
import { createFacilityNavigation } from './facilityTestData';

const { maps } = vi.hoisted(() => ({ maps: [] as L.Map[] }));
vi.mock('leaflet', async (importOriginal) => {
	const leaflet = await importOriginal<typeof L>();
	return {
		...leaflet,
		map: (...args: Parameters<typeof leaflet.map>) => {
			const map = leaflet.map(...args);
			maps.push(map);
			return map;
		}
	};
});

afterEach(() => {
	vi.restoreAllMocks();
	maps.length = 0;
});

async function setup() {
	vi.spyOn(globalThis, 'fetch').mockImplementation(
		async () =>
			new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 1700"></svg>')
	);
	const navigation = createFacilityNavigation();
	const rendered = await render(Map, { navigation });
	await expect.poll(() => rendered.container.querySelector('.facility-marker')).not.toBeNull();
	return { ...rendered, navigation, map: maps.at(-1)! };
}

describe('Map facility controls', () => {
	it.each([16, 24])(
		'高専祭の下段・中段で文字サイズ%i pxでも施設ボタンを収める',
		async (fontSize) => {
			await page.viewport(390, 844);
			const root = document.documentElement;
			const previousFontSize = root.style.fontSize;
			try {
				root.style.fontSize = `${fontSize}px`;
				const { container, getByRole } = await setup();
				const content = container.querySelector<HTMLElement>('.sheet-content')!;
				await expect.poll(() => content.scrollHeight - content.clientHeight).toBeLessThanOrEqual(1);
				expect(container.querySelector('[role="switch"]')).toBeNull();
				for (const label of ['近くのトイレを表示', '近くのゴミ箱を表示']) {
					const button = container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
					const text = document.createRange();
					text.selectNodeContents(button);
					expect(text.getClientRects().length).toBe(fontSize === 16 ? 1 : 2);
					expect(button.getBoundingClientRect().top).toBeGreaterThanOrEqual(
						content.getBoundingClientRect().top
					);
					expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(
						content.getBoundingClientRect().bottom
					);
				}
				await getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
				await expect.poll(() => content.scrollHeight - content.clientHeight).toBeLessThanOrEqual(1);
				const options = container.querySelector('[aria-label="検索オプション"]')!;
				expect(options.querySelectorAll('button')).toHaveLength(3);
				expect(
					container.querySelector('button[type="submit"]')!.getBoundingClientRect().bottom
				).toBeLessThanOrEqual(content.getBoundingClientRect().bottom);
			} finally {
				root.style.fontSize = previousFontSize;
			}
		}
	);

	it('右下に現在地ボタン、左下に帰属表示を置き、シートに追従する', async () => {
		const { container, getByRole } = await setup();
		const button = container.querySelector<HTMLButtonElement>('.current-location-button')!;
		const sheet = container.querySelector<HTMLElement>('.bottom-sheet')!;
		expect(button.disabled).toBe(false);
		expect(
			container.querySelector('.leaflet-bottom.leaflet-left .leaflet-control-attribution')
		).not.toBeNull();
		expect(
			container.querySelector('.leaflet-bottom.leaflet-right .leaflet-control-attribution')
		).toBeNull();
		const gap = () =>
			Math.abs(sheet.getBoundingClientRect().top - button.getBoundingClientRect().bottom - 8);
		await expect.poll(gap).toBeLessThan(1);
		expect(
			Math.abs(container.getBoundingClientRect().right - button.getBoundingClientRect().right - 8)
		).toBeLessThan(1);
		await getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await expect.poll(() => sheet.dataset.snap).toBe('middle');
		await expect.poll(gap).toBeLessThan(1);
		await getByRole('button', { name: 'ボトムシートの高さを変更' }).click();
		await expect.poll(() => container.querySelector('.current-location-button')).toBeNull();
	});

	it('GPS座標を受け取ると有効になり、ボタンで見えている地図の中央へ現在地を移す', async () => {
		const { container, getByRole, navigation, map } = await setup();
		const position = { x: 600, y: 750 };
		navigation.setGpsLocation({ enabled: true, position });
		await expect
			.poll(() => container.querySelector<HTMLButtonElement>('.current-location-button')?.disabled)
			.toBe(false);
		await getByRole('button', { name: '現在地に移動' }).click();
		await expect
			.poll(
				() => {
					const point = map.latLngToContainerPoint([position.y, position.x]);
					const sheetHeight = container
						.querySelector('.bottom-sheet')!
						.getBoundingClientRect().height;
					return (
						Math.abs(point.x - map.getSize().x / 2) < 2 &&
						Math.abs(point.y - (map.getSize().y - sheetHeight) / 2) < 2
					);
				},
				{ timeout: 3000 }
			)
			.toBe(true);
		navigation.setGpsLocation({ enabled: true, position: null });
		await expect
			.poll(() => container.querySelector<HTMLButtonElement>('.current-location-button')?.disabled)
			.toBe(true);
	});

	it('施設検索の結果を地図で絞り込み、結果の階を表示して解除時に戻す', async () => {
		const { container, navigation } = await setup();
		navigation.searchFacilities('toilet', 'women');
		navigation.setFacilityBuilding('la');
		await expect.poll(() => container.querySelector('[data-marker-id="women-la"]')).not.toBeNull();
		expect(container.querySelectorAll('.facility-marker')).toHaveLength(1);
		expect(container.querySelector('[data-marker-id="trash-outdoor"]')).toBeNull();
		navigation.clearFacilitySearch();
		await expect
			.poll(() => container.querySelector('[data-marker-id="trash-outdoor"]'))
			.not.toBeNull();
	});
});
