import { useEffect, useRef, useState } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { Feature, Polygon } from "geojson";

interface Props {
  fogShape: Feature<Polygon>;
  rimShape: Feature<Polygon>;
}

const DRIFT_X_PX_S = 5;
const DRIFT_Y_PX_S = 2;
const TILE = 512;

/**
 * The fog layers, with the cloud pattern drifting slowly like weather.
 * Drift state lives here so the ticker doesn't re-render the whole app.
 */
export function FogOverlay({ fogShape, rimShape }: Props) {
  const [drift, setDrift] = useState<[number, number]>([0, 0]);
  const t0 = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const t = (Date.now() - t0.current) / 1000;
      setDrift([(t * DRIFT_X_PX_S) % TILE, (t * DRIFT_Y_PX_S) % TILE]);
    }, 90);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <GeoJSONSource id="fog-rim" data={rimShape}>
        <Layer
          type="fill"
          id="fog-rim-fill"
          paint={{
            "fill-color": "#e9f2ee",
            "fill-opacity": 0.9,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="fog" data={fogShape}>
        <Layer
          type="fill"
          id="fog-fill"
          paint={{
            "fill-pattern": "clouds",
            "fill-opacity": 0.97,
            "fill-translate": drift,
            "fill-translate-anchor": "viewport",
          }}
        />
      </GeoJSONSource>
    </>
  );
}
