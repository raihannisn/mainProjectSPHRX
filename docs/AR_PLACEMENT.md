# AR: placing the model on a surface and keeping it there

Where: the Explorer (Solar System or a planet) -> AR. Phone camera AR and headset passthrough AR share the same
Place / Pick up / Reset controls.

## Phone camera AR

1. Tip the phone towards your table. The model floats on a flat surface about 0.5 m under the phone (Floor: 1.35 m), where
   the middle of the screen points. The Solar System lies flat like a disc; a planet rests on it; a ring marks the surface.
2. Tap the screen (or press Place here) to pin it. A tap that lands on a planet places the model, it does not open the planet.
3. Pinned, it stays on that spot in the camera picture when you turn, lean or step (see below). Pick up lets it follow
   your aim again; Reset brings it back in front of you and re-centres the compass.

### Why it stays put: `src/xr/visualTracker.ts`

A phone's motion sensors know how it TURNS but not where it MOVES, so sensors alone make a pinned model slide over the
table when you move. The camera picture has the missing part. Every ~33 ms the page reads a small copy of the camera
picture, follows a grid of patches from frame to frame (Lucas-Kanade, started from where the gyroscope says they went),
fits how the table moved around the pinned spot (shift, turn, zoom, squeeze), and carries the spot with it. The model is
drawn along the ray through that spot, nearer when the table looks bigger. If too little can be followed (a blank wall,
a very fast pan) the gyroscope's turning carries the spot instead.

Limits: a plain, texture-less table gives the tracker little to hold on to; it works best on a table with a pattern, grain
or objects on it. Moving things in the picture (a hand, a person) are ignored when most of the picture agrees. Position
is assumed, not measured, so sizes and distances are approximate. True table detection needs ARCore (Android Chrome) or a
headset; iPhone Safari has no WebXR AR.

## Headset passthrough AR

The model is placed 1 m in front of you, pins itself after about a second, and has 3D Place here / Pick up and Reset
buttons under it. The floor is known to the headset, so it needs no tracking help.

## Tests

- `node scripts/test-visual-tracker.mjs`: renders a textured table from a known camera path and checks the pinned spot
  stays on its table point (about 4 px of a 96 px wide picture after a 0.4 m slide; the sensors alone are off by 48 px).
- `node scripts/smoke-ar-place.mjs --base=http://localhost:5173` (dev server): the controls, tap-to-place, Pick up,
  Reset, Table / Floor, pinning against turning, a synthetic camera picture that slides (the model must slide with it),
  and the emulated Quest's passthrough.
