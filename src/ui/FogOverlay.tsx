import { useEffect, useRef, useState } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { Feature, Polygon } from "geojson";

interface Props {
  fogShape: Feature<Polygon>;
  rimShape: Feature<Polygon>;
}

// fill-translate shifts the whole fog geometry, not just the texture —
// so the motion must stay tiny: a slow floating sway, never a scroll.
const SWAY_X_PX = 5;
const SWAY_Y_PX = 3.5;

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
      setDrift([
        SWAY_X_PX * Math.sin(t * 0.35),
        SWAY_Y_PX * Math.cos(t * 0.23),
      ]);
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
            // Misty, not opaque: big shapes ghost through, details don't.
            "fill-opacity": 0.84,
            "fill-translate": drift,
            "fill-translate-anchor": "viewport",
          }}
        />
      </GeoJSONSource>
    </>
  );
}
