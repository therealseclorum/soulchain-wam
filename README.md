# Soulchain WAM

Soulchain is a Web Audio Module 2.0 prototype.

## What is included

- Seed -> Harmony -> Ghost -> Shadow -> Space -> Memory
- Procedural Web Audio synthesis
- Mutation
- Tempo and level
- MIDI note handling
- WAM GUI
- No audio files required

## Important

A WAM is not loaded by giving a host an arbitrary HTML file. The WAM entry point is `index.js`; the GUI is created by `gui.js`.

The plugin should be served over HTTP(S), not opened with `file://`.

## Recommended first test

Use the official WAM 2 example host:

https://mainline.i3s.unice.fr/wam2/packages/_/

The official WAM SDK documentation describes the plugin URL workflow and uses `index.js` as the plugin entry point.

## Hosting

The easiest route is GitHub Pages.

1. Create a public GitHub repository named `soulchain-wam`.
2. Upload all files from this folder.
3. Enable GitHub Pages for the main branch/root.
4. Your plugin will be available at:

https://YOUR-USERNAME.github.io/soulchain-wam/index.js

Paste that URL into a WAM host's Plugin URL field.

## Notes

This is a prototype. Browser/WAM hosts differ in which WAM extensions they support. The core WAM SDK interface is used here; host-specific extensions should be added only after the basic plugin loads and makes sound.
