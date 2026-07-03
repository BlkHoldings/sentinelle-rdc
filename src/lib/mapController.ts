type FlyToOpts = {
  longitude: number;
  latitude:  number;
  zoom:      number;
  pitch?:    number;
  bearing?:  number;
};

let _flyTo: ((opts: FlyToOpts) => void) | null = null;

export function registerFlyTo(fn: (opts: FlyToOpts) => void): void {
  _flyTo = fn;
}

export function flyTo(opts: FlyToOpts): void {
  _flyTo?.(opts);
}
