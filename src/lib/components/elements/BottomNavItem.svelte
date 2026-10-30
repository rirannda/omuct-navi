<script lang="ts">
	let { id, isActive, onclick } = $props<{
		id: string;
		isActive: boolean;
		onclick: () => void;
	}>();
</script>

<button
	class="flex h-15 w-full items-center justify-center border-t-2 bg-white {isActive
		? 'border-blue-400'
		: 'border-gray-300'}"
	{onclick}
>
	<span class="material-symbols-outlined">{id}</span>
</button>
