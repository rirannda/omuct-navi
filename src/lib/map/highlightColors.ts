export const highlightColors = {
	start: { fill: '#22c55e', stroke: '#15803d', text: '#14532d' },
	goal: { fill: '#ef4444', stroke: '#b91c1c', text: '#7f1d1d' },
	selected: { fill: '#fbbf24', stroke: '#b45309', text: '#78350f' }
} as const;

export type HighlightColor = keyof typeof highlightColors;
export const highlightRoles = ['start', 'goal', 'selected'] as const;
