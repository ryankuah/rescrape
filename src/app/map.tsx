"use client";
import React, {
  useState,
  Fragment,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Map, { Marker, Popup, type MapRef } from "react-map-gl";
import { PiMapPinSimpleFill } from "react-icons/pi";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { submitStatus } from "./submit";
import { FaCheck, FaXmark } from "react-icons/fa6";
import { SelectNative } from "~/components/ui/select-native";

type Property = {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  longitude: number;
  latitude: number;
  status: string;
};

export default function MapComponent({
  propertyArr,
  apiKey,
}: {
  propertyArr: Property[];
  apiKey: string;
}) {
  const [openPopupId, setOpenPopupId] = useState<number | null>(null);
  const mapRef = useRef<MapRef>(null);

  async function handleSubmit(propertyId: number, status: string) {
    await submitStatus(propertyId, status);

    setPropertyOg(
      propertyOg.map((property) => {
        if (property.id === propertyId) {
          return { ...property, status };
        }
        return property;
      }),
    );
  }
  const flyTo = useCallback((longitude: number, latitude: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 17,
      });
    }
  }, []);

  const togglePopup = (propertyId: number) => {
    setOpenPopupId((prevId) => (prevId === propertyId ? null : propertyId));
  };

  const [propertyOg, setPropertyOg] = useState<Property[]>(propertyArr);
  const [properties, setProperty] = useState<Property[]>(propertyOg);
  const [sort, setSort] = useState("all");

  useEffect(() => {
    switch (sort) {
      case "new":
        setProperty(
          propertyOg.filter(
            (property) => property.status === null || undefined,
          ),
        );
        break;
      case "all":
        setProperty(propertyOg);
        break;
      case "shortlist":
        setProperty(
          propertyOg.filter((property) => property.status === "shortlist"),
        );
        break;
      case "longlist":
        setProperty(
          propertyOg.filter((property) => property.status === "longlist"),
        );
        break;
      case "no":
        setProperty(propertyOg.filter((property) => property.status === "no"));
        break;
      default:
        setProperty(propertyOg);
    }
  }, [sort, propertyOg]);
  return (
    <div>
      <SelectNative
        className="mb-2 h-max w-max"
        onChange={(e) => setSort(e.target.value)}
        value={sort}
      >
        <option value="new">New</option>
        <option value="shortlist">Short List</option>
        <option value="longlist">Long List</option>
        <option value="no">No</option>
        <option value="all">All</option>
      </SelectNative>
      <div className="flex h-full w-full flex-row gap-4">
        <Map
          ref={mapRef}
          mapboxAccessToken={apiKey}
          initialViewState={{
            latitude: 38.7946,
            longitude: -98.5348,
            zoom: 3,
          }}
          style={{ width: "50vw", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/standard-satellite"
        >
          {properties?.map((property) => (
            <Fragment key={property.id}>
              <Marker
                longitude={property.longitude}
                latitude={property.latitude}
                onClick={() => togglePopup(property.id)}
              >
                <PiMapPinSimpleFill
                  color={
                    property.status === "shortlist"
                      ? "lightgreen"
                      : property.status === "longlist"
                        ? "blue"
                        : property.status === "no"
                          ? "red"
                          : "black"
                  }
                  size={20}
                />
              </Marker>
              {openPopupId === property.id && (
                <Popup
                  longitude={property.longitude}
                  latitude={property.latitude}
                  onClose={() => setOpenPopupId(null)}
                  anchor="bottom"
                  offset={[0, -10]}
                  closeButton={true}
                  closeOnClick={false}
                >
                  <div>
                    <Link
                      href={`/park/${property.id}`}
                      className="font-semibold text-blue-400"
                    >
                      {property.name}
                    </Link>
                    <p>
                      {property.street}, {property.city},{property.state},{" "}
                      {property.zip}
                    </p>
                  </div>
                </Popup>
              )}
            </Fragment>
          ))}
        </Map>
        <div className="flex h-screen flex-col gap-4 overflow-y-scroll">
          {properties?.map((property) => (
            <div
              className="flex cursor-pointer flex-col rounded-lg border-2 border-black bg-gray-400 p-4"
              key={property.id}
            >
              <div
                className="cursor-pointer"
                onClick={() => flyTo(property.longitude, property.latitude)}
              >
                <div className="flex flex-row">
                  <Link
                    className="text-blue-800 underline"
                    href={`/park/${property.id}`}
                  >
                    {property.name}
                  </Link>
                  {property.status === "shortlist" ||
                  property.status === "longlist" ? (
                    <FaCheck
                      color={property.status === "shortlist" ? "green" : "blue"}
                    />
                  ) : (
                    <>
                      {property.status === "no" ? (
                        <FaXmark color="red" />
                      ) : null}
                    </>
                  )}
                </div>
                <br />
                {property.state}, {property.city}
                <br />
                {property.street}, {property.zip}
              </div>
              <div className="flex flex-row items-center justify-center gap-2">
                <button
                  className="rounded-md border border-black bg-green-500 p-2"
                  onClick={async () => handleSubmit(property.id, "shortlist")}
                >
                  Short List
                </button>
                <button
                  className="rounded-md border border-black bg-blue-500 p-2"
                  onClick={async () => handleSubmit(property.id, "longlist")}
                >
                  Long List
                </button>
                <button
                  className="rounded-md border border-black bg-red-500 p-2"
                  onClick={async () => handleSubmit(property.id, "no")}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
