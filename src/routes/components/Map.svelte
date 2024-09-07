<script lang="ts">
    import {CircleLayer, GeoJSON, MapLibre, RasterLayer, RasterTileSource} from "svelte-maplibre";
    import {WidgetPlaceholder} from "flowbite-svelte";

    import {showSuccessToast} from "../../services/toaster-service";
    import {GeoJSONFeatureCollection} from "../../../sharedModels/interfaces";

    export let mapLoaded: boolean;
    export let geoJsonData: GeoJSONFeatureCollection;
</script>

{#if mapLoaded}
    <MapLibre
            center={[4.369681, 51.307764]}
            zoom={10}
            class="map"
            standardControls
            style="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json">
        <GeoJSON
                id="geojsonData"
                data={geoJsonData}
                cluster={{ 
      radius: 500,
      maxZoom: 14,
    }}
                on:layeradd={() => console.log("GeoJSON layer added.")}
                on:error={(e) => console.error("GeoJSON error:", e)}
        >
            <RasterTileSource tiles={['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']} tileSize={256}>
                <RasterLayer paint={{}}/>
            </RasterTileSource>
            <CircleLayer
                    on:click={()=>showSuccessToast("Clicked a cluster!", "congrats, it works!")}
                    id="clusters"
                    applyToClusters
                    paint={{
                'circle-color': ['step', ['get', 'point_count'], 
                '#ff8600', 50,
                 '#f1f075', 750, 
                 '#f28cb1'],
                'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
            }}
            />

            <CircleLayer
                    id="points"
                    applyToClusters={false}
                    paint={{
                'circle-color': '#ff0051',
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff',
            }}
            />
        </GeoJSON>
    </MapLibre>
{/if}

{#if !mapLoaded}
    <WidgetPlaceholder class="mx-auto"/>
{/if}