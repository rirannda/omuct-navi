export type LabelBounds = { x: number; y: number; width: number; height: number };
export type RouteLabel = LabelBounds & { anchorX: number; anchorY: number };

function overlaps(a: LabelBounds, b: LabelBounds, gap: number): boolean {
	return (
		a.x < b.x + b.width + gap &&
		a.x + a.width + gap > b.x &&
		a.y < b.y + b.height + gap &&
		a.y + a.height + gap > b.y
	);
}

/** 画面内の空いた位置を優先し、吹き出し同士と操作パネルの重なりを避けます。 */
export function layoutRouteLabels(
	labels: readonly RouteLabel[],
	viewport: { width: number; height: number },
	obstacles: readonly LabelBounds[] = []
): LabelBounds[] {
	const gap = 8;
	const padding = 8;
	const occupied = [...obstacles];
	return labels.map((label) => {
		const maxX = Math.max(padding, viewport.width - label.width - padding);
		const maxY = Math.max(padding, viewport.height - label.height - padding);
		const clampX = (x: number) => Math.max(padding, Math.min(x, maxX));
		const clampY = (y: number) => Math.max(padding, Math.min(y, maxY));
		const xs = new Set([
			clampX(label.x),
			clampX(label.anchorX + 26),
			clampX(label.anchorX - label.width - 26),
			clampX(label.anchorX - label.width / 2),
			padding,
			maxX
		]);
		const ys = new Set([
			clampY(label.y),
			clampY(label.anchorY + 26),
			clampY(label.anchorY - label.height - 26),
			padding,
			maxY
		]);
		for (const rect of occupied) {
			ys.add(clampY(rect.y + rect.height + gap));
			ys.add(clampY(rect.y - label.height - gap));
		}
		let best: LabelBounds | undefined;
		let bestDistance = Infinity;
		for (const x of xs) {
			for (const y of ys) {
				const rect = { x, y, width: label.width, height: label.height };
				const distance = (x - label.x) ** 2 + (y - label.y) ** 2;
				if (distance >= bestDistance || occupied.some((other) => overlaps(rect, other, gap)))
					continue;
				best = rect;
				bestDistance = distance;
			}
		}
		// 収まる余地がない場合も吹き出しを重ねず、画面の下側へ続けます。
		if (!best) {
			best = { x: clampX(label.x), y: maxY, width: label.width, height: label.height };
			let collisions = occupied.filter((other) => overlaps(best!, other, gap));
			while (collisions.length) {
				best.y = Math.max(...collisions.map((other) => other.y + other.height + gap));
				collisions = occupied.filter((other) => overlaps(best!, other, gap));
			}
		}
		occupied.push(best);
		return best;
	});
}
