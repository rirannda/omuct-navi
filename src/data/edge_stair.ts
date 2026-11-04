import type { Edges } from './types';

export const edgeStairs: Edges = [
	{
		fromNode: 'node_la_f1_stair_west',
		toNode: 'node_la_f2_stair_west',
		isStairs: true
	},
	{
		fromNode: 'node_la_f2_stair_west',
		toNode: 'node_la_f3_stair_west',
		isStairs: true
	},
	{
		fromNode: 'node_la_f1_stair_east',
		toNode: 'node_la_f2_stair_east',
		isStairs: true
	},
	{
		fromNode: 'node_la_f2_stair_east',
		toNode: 'node_la_f3_stair_east',
		isStairs: true
	},
	{
		fromNode: 'node_lib_f1_stair',
		toNode: 'node_lib_f2_stair',
		isStairs: true
	},
	{
		fromNode: 'node_staircase_f1_stair',
		toNode: 'node_staircase_f2_stair',
		isStairs: true
	},
	{
		fromNode: 'node_entrance_f0_stair_west_f1',
		toNode: 'node_entrance_f1_cnr',
		isStairs: true
	},
	{
		fromNode: 'node_entrance_f0_stair_east_f1',
		toNode: 'node_entrance_f1_cnr',
		isStairs: true
	},
	{
		fromNode: 'node_entrance_f0_stair_west_f2',
		toNode: 'node_entrance_f2_cnr',
		isStairs: true
	},
	{
		fromNode: 'node_entrance_f0_stair_east_f2',
		toNode: 'node_entrance_f2_cnr',
		isStairs: true
	},
	{
		fromNode: 'node_outdoor_f0_str_cafe',
		toNode: 'node_outdoor_f0_ee_cafe',
		isStairs: true
	},
	{
		fromNode: 'node_skybridge_f2_cnr_stair_ee_la-north',
		toNode: 'node_skybridge_f2_ee_la-north',
		isStairs: true
	},
	{
		fromNode: 'node_skybridge_f2_ee_clock',
		toNode: 'node_skybridge_f2_point_clock-ne',
		isStairs: true
	},
	{
		fromNode: 'node_skybridge_f2_point_clock-se',
		toNode: 'node_skybridge_f2_ee_clock',
		isStairs: true
	},
	{
		fromNode: 'node_skybridge_f2_cnr_ee_la-south',
		toNode: 'node_skybridge_f2_ee_la-south',
		isStairs: true
	}
];
