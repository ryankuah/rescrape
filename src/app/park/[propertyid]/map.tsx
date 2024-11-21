"use client";
import Map, { Marker } from "react-map-gl";
import { FaMapPin } from "react-icons/fa6";

export default function MapComponent({
  longitude,
  latitude,
  zoom,
  apiKey,
}: {
  longitude: number;
  latitude: number;
  zoom: number;
  apiKey: string;
}) {
  return (
    <Map
      mapboxAccessToken={apiKey}
      initialViewState={{
        longitude,
        latitude,
        zoom,
      }}
      style={{ width: "50vw", height: "50vh" }}
      mapStyle="mapbox://styles/mapbox/standard-satellite"
    >
      <Marker longitude={longitude} latitude={latitude}></Marker>
    </Map>
  );
}
