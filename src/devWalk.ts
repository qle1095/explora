/**
 * Dev-only bridge: the on-screen D-pad emits mock positions that flow
 * through the same fix-handling path as real GPS. Never used in release.
 */
type Listener = (lat: number, lng: number) => void;

let listener: Listener | null = null;

export function onDevWalk(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function devWalkTo(lat: number, lng: number): void {
  listener?.(lat, lng);
}
