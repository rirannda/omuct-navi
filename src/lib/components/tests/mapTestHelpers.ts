import { expect } from 'vitest';
import { buildingMaps } from '../../../data/maps';

export async function tapBuilding(container: HTMLElement, id: string) {
	const building = buildingMaps.find((building) => building.id === id)!;
	const selector = `.building-selectable#${CSS.escape(building.svgId ?? id)}`;
	await expect.poll(() => container.querySelector(selector)).not.toBeNull();
	container.querySelector(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await expect.poll(() => container.querySelector(`[data-building="${id}"]`)).not.toBeNull();
}
