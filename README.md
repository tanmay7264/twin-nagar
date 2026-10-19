# Twin Nagar: a glucose digital twin living in a city

A dense isometric 3D city district (3x3 blocks, roads with markings, traffic, a skyline, day and night) where **Asha (58, type 2 diabetes)** lives a day (home, café breakfast, office, bazaar lunch, park walk, dinner, sleep)
while a **glucose digital twin** follows her. At the **Twin Lab** you change her day (swap meals, add walks, drop the 4:30 biscuit) and the twin
shows the whole-day result, with uncertainty bands, *before* she tries it. Then you can let Asha follow the plan and watch the day replay.

Built with Tanmay's BM Ecosystem Builder (credit is part of the page).

## Run
```bash
python3 -m http.server 8790        # in this folder, then open http://localhost:8790
```
Needs internet for Three.js (CDN). Press Space to pause, "Follow Asha" to track her, 1x/2x/4x for speed. Deep links: `#lab`, `#cafe`, ...

## What you see
- **Buildings open up.** When Asha walks in (or you click a building) the roof lifts away and you see the rooms: her bedroom upstairs, the café counter, the open-plan office, the bazaar stalls, the clinic's CGM reader, the Twin Lab's holographic table, a gym and a yoga class. Multi-storey buildings have a Floor switch.
- **Asha is drawn large**, with a pin and halo, and the camera follows her (zooms in further indoors). Toggle "Follow Asha" to look around freely.
- Bystanders walk the sidewalks, cars and autos drive the roads, windows light up after dark.
- `window.twinNagar.jump(13, 30)` jumps the clock for demos.

## How it works
- `twin.js` is a browser port of the research twin's mechanistic core (`../twin/model.py`): Bergman-style minimal model with a two-pool gut. Verified against the Python model on a full day (same glucose trace to 2 decimals).
- Asha's parameters are the calibrated posterior of real CGMacros participant C049 (HbA1c 7.2%). Ensembles draw from that posterior plus about 20% meal-portion noise.
- The live forecast (teal band) rolls the ODE 2 h ahead from the current state and assumes no new meals.
- `cityscape.js` builds roads, blocks, filler towers, traffic and the clickable buildings; `interiors.js` builds each building's cutaway rooms and inhabitants; `figures.js` the people.
- `city.js` builds the day (routes along the streets, poses, exercise and meal inputs), the HUD, bystanders, day/night light and the Twin Lab. `world.config.js` holds all content.

## Honest limits
- It is a simulation: Asha's "true" glucose is one draw from the twin's own posterior, so forecast and reality share a model. The research repo's validation on real data is in `../README.md`.
- Only carbohydrate (approximate values) and walking are modelled. Sleep, stress, yoga, protein and fat effects beyond absorption speed are not. Calibrated glucose-effectiveness is poorly identified for this participant (wide posterior, capped for display).
- Illustrative only, not medical advice.
