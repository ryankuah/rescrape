"use client";
import Map, { Marker } from "react-map-gl";

export default function MapComponent({
  longitude,
  latitude,
  apiKey,
}: {
  longitude: number;
  latitude: number;
  apiKey: string;
}) {
  return (
    <Map
      mapboxAccessToken={apiKey}
      initialViewState={{
        longitude,
        latitude,
        zoom: 15,
      }}
      style={{ width: "50vw", height: "50vh" }}
      mapStyle="mapbox://styles/mapbox/standard-satellite"
    >
      <Marker longitude={longitude} latitude={latitude}></Marker>
    </Map>
  );
}
