import { useEffect, useRef, useState } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { Feature, MultiPolygon, Polygon } from "geojson";

interface Props {
  fogShape: Feature<Polygon>;
  rimShape: Feature<MultiPolygon>;
}

// fill-translate shifts the whole fog geometry, not just the texture —
// so the motion must stay tiny: a slow floating sway, never a scroll.
const SWAY_X_PX = 5;
const SWAY_Y_PX = 3.5;

/**
 * How much of the map the mist hides. clouds.png has no alpha channel, so
 * this is the only thing making the fog translucent — unexplored ground
 * must stay readable (you can see where to go; you still have to go there).
 * Tune here, not by stacking extra layers underneath.
 */
const MIST_OPACITY = 0.5;

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
            // Only a thin halo on the cleared side of the edge, so it reads
            // as mist thinning out rather than an outline.
            "fill-opacity": 0.5,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="fog" data={fogShape}>
        <Layer
          type="fill"
          id="fog-fill"
          paint={{
            "fill-pattern": "clouds",
            "fill-opacity": MIST_OPACITY,
            "fill-translate": drift,
            "fill-translate-anchor": "viewport",
          }}
        />
      </GeoJSONSource>
    </>
  );
}
