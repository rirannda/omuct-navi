<script lang="ts">
	import { provideNavigation } from '#lib';
	import OMUCTMap from '#lib/components/Map.svelte';

	const navigation = provideNavigation();
</script>

<OMUCTMap {navigation} />
