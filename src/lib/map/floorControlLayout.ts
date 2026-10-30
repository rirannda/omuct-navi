import type { LabelBounds } from '../route/labelLayout';

export type FloorControlSide = 'top' | 'right' | 'bottom' | 'left';
// CSSピクセル単位。地図のズーム倍率にかかわらず同じ長さに制限します。
export const MAX_FLOOR_CONTROL_LINE_LENGTH = 96;
export type FloorControlBuilding = LabelBounds & {
	id: string;
	/** 画面座標でサンプリングした実際のSVG輪郭。 */
	outline?: readonly { x: number; y: number }[];
};
export type FloorControl = {
	id: string;
	width: number;
	height: number;
	previousSide?: FloorControlSide;
};
export type FloorControlPlacement = LabelBounds & {
	id: string;
	side: FloorControlSide;
	anchorX: number;
	anchorY: number;
	lineX: number;
	lineY: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, Math.max(min, max)));
}

function overlapArea(a: LabelBounds, b: LabelBounds, gap = 0): number {
	return (
		Math.max(0, Math.min(a.x + a.width, b.x + b.width + gap) - Math.max(a.x, b.x - gap)) *
		Math.max(0, Math.min(a.y + a.height, b.y + b.height + gap) - Math.max(a.y, b.y - gap))
	);
}

/** 接続線の上限を守り、UI同士の重なり、建物を覆う面積、距離の順で位置を選びます。 */
export function layoutFloorControls(
	controls: readonly FloorControl[],
	buildings: readonly FloorControlBuilding[],
	viewport: { width: number; height: number },
	obstacles: readonly LabelBounds[] = []
): FloorControlPlacement[] {
	const padding = 8;
	const topPadding = 50;
	const gap = 12;
	const buildingById = new Map(buildings.map((building) => [building.id, building]));
	const anchorCache = new Map<string, Map<string, { x: number; y: number }>>();

	function isBetter(score: readonly number[], other: readonly number[]): boolean {
		return score.some(
			(value, index) =>
				value < other[index] &&
				score.slice(0, index).every((previous, previousIndex) => previous === other[previousIndex])
		);
	}

	function placementScore(
		rect: LabelBounds,
		control: FloorControl,
		side: FloorControlSide,
		occupied: readonly LabelBounds[]
	): number[] {
		const building = buildingById.get(control.id)!;
		const centerX =
			(clamp(building.x, 0, viewport.width) +
				clamp(building.x + building.width, 0, viewport.width)) /
			2;
		const centerY =
			(clamp(building.y, 0, viewport.height) +
				clamp(building.y + building.height, 0, viewport.height)) /
			2;
		return [
			occupied.reduce((sum, obstacle) => sum + overlapArea(rect, obstacle, 8), 0),
			buildings.reduce((sum, obstacle) => sum + overlapArea(rect, obstacle, 4), 0),
			(rect.x + control.width / 2 - centerX) ** 2 +
				(rect.y + control.height / 2 - centerY) ** 2 +
				(control.previousSide && control.previousSide !== side ? 144 : 0)
		];
	}

	function place(
		control: FloorControl,
		occupied: readonly LabelBounds[],
		maxLineLength = Infinity
	): FloorControlPlacement | undefined {
		if (topPadding + control.height + padding > viewport.height) return;
		const building = buildingById.get(control.id)!;
		const left = clamp(building.x, 0, viewport.width);
		const right = clamp(building.x + building.width, 0, viewport.width);
		const top = clamp(building.y, 0, viewport.height);
		const bottom = clamp(building.y + building.height, 0, viewport.height);
		const centerX = (left + right) / 2;
		const centerY = (top + bottom) / 2;
		const clampX = (x: number) => clamp(x, padding, viewport.width - control.width - padding);
		const clampY = (y: number) => clamp(y, topPadding, viewport.height - control.height - padding);
		const xs = new Set([
			centerX - control.width / 2,
			left,
			right - control.width,
			padding,
			viewport.width - control.width - padding
		]);
		const ys = new Set([
			centerY - control.height / 2,
			top,
			bottom - control.height,
			topPadding,
			viewport.height - control.height - padding
		]);
		// 辺に沿ってずらす候補も加え、隣の建物や配置済みパネルの脇を探します。
		for (const rect of [...buildings, ...occupied]) {
			xs.add(rect.x - control.width - gap);
			xs.add(rect.x + rect.width + gap);
			ys.add(rect.y - control.height - gap);
			ys.add(rect.y + rect.height + gap);
		}
		let best: FloorControlPlacement | undefined;
		let bestScore = [Infinity, Infinity, Infinity];
		function consider(side: FloorControlSide, candidateX: number, candidateY: number) {
			const x = clampX(candidateX);
			const y = clampY(candidateY);
			const rect = { x, y, width: control.width, height: control.height };
			const vertical = side === 'left' || side === 'right';
			let anchorX = vertical
				? side === 'left'
					? left
					: right
				: clamp(x + control.width / 2, left, right);
			let anchorY = vertical
				? clamp(y + control.height / 2, top, bottom)
				: side === 'top'
					? top
					: bottom;
			if (building.outline?.length) {
				let cache = anchorCache.get(control.id);
				if (!cache) anchorCache.set(control.id, (cache = new Map()));
				const key = `${x},${y}`;
				let anchor = cache.get(key);
				if (!anchor) {
					anchor = building.outline[0];
					let distance = Infinity;
					for (const point of building.outline) {
						const squaredDistance =
							(point.x - x - control.width / 2) ** 2 + (point.y - y - control.height / 2) ** 2;
						if (squaredDistance < distance) {
							anchor = point;
							distance = squaredDistance;
						}
					}
					cache.set(key, anchor);
				}
				anchorX = anchor.x;
				anchorY = anchor.y;
			}
			const lineX = clamp(anchorX, x, x + control.width);
			const lineY = clamp(anchorY, y, y + control.height);
			// 再配置時は実際に描く線の長さで候補を除外します。
			if (Math.hypot(anchorX - lineX, anchorY - lineY) > maxLineLength) return;
			const score = placementScore(rect, control, side, occupied);
			if (!isBetter(score, bestScore)) return;
			bestScore = score;
			best = { ...rect, id: control.id, side, anchorX, anchorY, lineX, lineY };
		}
		for (const side of ['right', 'bottom', 'left', 'top'] as const) {
			const vertical = side === 'left' || side === 'right';
			for (const along of vertical ? ys : xs) {
				consider(
					side,
					vertical
						? side === 'left'
							? building.x - control.width - gap
							: building.x + building.width + gap
						: along,
					vertical
						? along
						: side === 'top'
							? building.y - control.height - gap
							: building.y + building.height + gap
				);
			}
		}
		// L字形の外接矩形だけが見える場合も、実際の輪郭の近くへ配置し直します。
		if (!best && building.outline?.length) {
			const step = Math.max(1, Math.ceil(building.outline.length / 32));
			for (let index = 0; index < building.outline.length; index += step) {
				const point = building.outline[index];
				consider('right', point.x + gap, point.y - control.height / 2);
				consider('bottom', point.x - control.width / 2, point.y + gap);
				consider('left', point.x - control.width - gap, point.y - control.height / 2);
				consider('top', point.x - control.width / 2, point.y - control.height - gap);
			}
		}
		return best;
	}

	function arrange(order: readonly FloorControl[]): FloorControlPlacement[] {
		const placements: FloorControlPlacement[] = [];
		for (const control of order) {
			if (!buildingById.has(control.id)) continue;
			const position = place(control, [...obstacles, ...placements]);
			if (position) placements.push(position);
		}
		// 後から置いたUIも考慮して調整します。
		for (let pass = 0; pass < 2; pass++) {
			for (let index = 0; index < placements.length; index++) {
				const control = controls.find(({ id }) => id === placements[index].id)!;
				placements[index] =
					place(control, [
						...obstacles,
						...placements.filter((_, otherIndex) => otherIndex !== index)
					]) ?? placements[index];
			}
		}
		return placements;
	}

	const positions = arrange(controls);
	// 短い線で収まっているUIを保ち、上限を超えたUIだけを近くへ配置し直します。
	for (let index = 0; index < positions.length; index++) {
		const position = positions[index];
		if (
			Math.hypot(position.anchorX - position.lineX, position.anchorY - position.lineY) <=
			MAX_FLOOR_CONTROL_LINE_LENGTH
		)
			continue;
		const control = controls.find(({ id }) => id === position.id)!;
		const replacement = place(
			control,
			[...obstacles, ...positions.filter((_, otherIndex) => otherIndex !== index)],
			MAX_FLOOR_CONTROL_LINE_LENGTH
		);
		if (replacement) positions[index] = replacement;
		else positions.splice(index--, 1);
	}
	return positions;
}
