import { buildingNames } from './buildings';

export type BuildingMap = {
	id: string;
	name: string;
	/** 共通図でタップする建物のSVG ID。省略時は建物IDを使います。 */
	svgId?: string;
	/** SVG座標の建物範囲: 左、上、右、下。 */
	bounds: [number, number, number, number];
	floors: Record<number, string>;
	floorOrder?: readonly number[];
	floorLabels?: Readonly<Record<number, string>>;
	/** 階を選択していないときに表示する共通図。 */
	overview?: string;
};

export const baseMapFiles = ['master.svg', 'main-gate.svg'];

export const buildingMaps: BuildingMap[] = [
	{
		id: 'la',
		svgId: 'la-bldg',
		name: buildingNames.la,
		bounds: [381, 1027.5, 581, 1182.5],
		floors: { 1: 'la-bldg_F1.svg', 2: 'la-bldg_F2.svg', 3: 'la-bldg_F3.svg' }
	},
	{
		id: 'ss1',
		svgId: 'ss-bldg_1',
		name: buildingNames.ss1,
		bounds: [627, 836, 933, 929.5],
		floors: {
			1: 'ss-bldg_1_F1.svg',
			2: 'ss-bldg_1_F2.svg',
			3: 'ss-bldg_1_F3.svg',
			4: 'ss-bldg_1_F4.svg'
		}
	},
	{
		id: 'ss2',
		svgId: 'ss-bldg_2',
		name: buildingNames.ss2,
		bounds: [256, 836, 579, 929],
		floors: {
			1: 'ss-bldg_2_F1.svg',
			2: 'ss-bldg_2_F2.svg',
			3: 'ss-bldg_2_F3.svg',
			4: 'ss-bldg_2_F4.svg'
		}
	},
	{
		id: 'cepc',
		svgId: 'cpec-bldg',
		name: buildingNames.cepc,
		bounds: [951.5, 805.5, 1116, 889.5],
		floors: { 1: 'cepc-bldg_F1.svg', 2: 'cepc-bldg_F2.svg', 3: 'cepc-bldg_F3.svg' }
	},
	{
		id: 'gym',
		name: buildingNames.gym,
		bounds: [741, 1317, 954, 1453],
		floors: { 1: 'gym_F1.svg', 2: 'gym_F2.svg' }
	},
	{
		id: 'lib',
		name: buildingNames.lib,
		bounds: [814, 1020, 921, 1148],
		floors: { 1: 'lib_F1.svg', 2: 'lib_F2.svg' }
	},
	{
		id: 'cafe',
		name: buildingNames.cafe,
		bounds: [748, 1195, 832.5, 1272],
		floors: { 0: 'cafe_B1.svg', 1: 'cafe_F1.svg' },
		floorOrder: [1, 0],
		floorLabels: { 0: '地上' }
	},
	{
		id: 'mah',
		name: buildingNames.mah,
		bounds: [980, 1341.5, 1120, 1430.5],
		floors: { 1: 'mah.svg' }
	},
	{
		id: 'staircase',
		svgId: 'centralstaircase',
		name: buildingNames.staircase,
		bounds: [579, 836, 627, 929.5],
		floors: {
			1: 'staircase_F1.svg',
			2: 'staircase_F2.svg',
			3: 'staircase_F3.svg',
			4: 'staircase_F4.svg'
		}
	},
	{
		id: 'skybridge',
		name: buildingNames.skybridge,
		bounds: [579, 889.5, 687, 1276.5],
		floors: { 1: 'skybridge_f1.svg', 2: 'skybridge_f2.svg' }
	},
	{
		id: 'entrance',
		name: buildingNames.entrance,
		bounds: [561.5, 1276.5, 766.5, 1324],
		floors: { 0: 'entrance.svg', 1: 'entrance_f1.svg', 2: 'entrance_f2.svg' },
		floorOrder: [2, 0, 1],
		floorLabels: { 0: '地上' },
		overview: 'entrance.svg'
	}
];
