export const buildingNames: Record<string, string> = {
	la: '教養棟',
	ss1: '専門棟1',
	ss2: '専門棟2',
	admin: '管理棟',
	gym: '体育館',
	cepc: '共育連携センター',
	mah: '武道館',
	stg: '倉庫',
	cr: '部室',
	lib: '図書館',
	cafe: '食堂',
	entrance: 'エントランス',
	skybridge: '渡り廊下',
	staircase: '中央階段',
	outdoor: '屋外'
};

/** 詳細図がなく、データ上の階番号だけでは実際の所在階を判断できない建物。 */
export const buildingFloorLabels: Readonly<Record<string, Readonly<Record<number, string>>>> = {
	admin: { 0: '階不明' }
};
