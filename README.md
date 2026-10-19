# Twin Nagar: a glucose digital twin living in a city

A dense isometric 3D city district (3x3 blocks, roads with markings, traffic, a skyline, day and night) where **Asha (58, type 2 diabetes)** lives a day (home, café breakfast, office, bazaar lunch, park walk, dinner, sleep)
while a **glucose digital twin** follows her. At the **Twin Lab** you change her day (swap meals, add walks, drop the 4:30 biscuit) and the twin
shows the whole-day result, with uncertainty bands, *before* she tries it. Then you can let Asha follow the plan and watch the day replay.

**Live:** <https://tanmay7264.github.io/twin-nagar/> · **Research twin dashboard:** <https://glucose-digital-twin.onrender.com> ([repo](https://github.com/tanmay7264/glucose-digital-twin))

Built with Tanmay's BM Ecosystem Builder (credit is part of the page).

## Run
```bash
python3 -m http.server 8790        # in this folder, then open http://localhost:8790
```
Needs internet for Three.js (CDN). Press Space to pause, "Follow Asha" to track her, 1x/2x/4x for speed. Deep links: `#lab`, `#cafe`, ...

## What's in the city now
- **16 places** in a 4x4 grid (one is the park): Home, Udupi Café, Medplus Pharmacy, Tech Office, Happiest Health Clinic, Lake Park, Fresh Mart, Bazaar Lunch, Community Gym, Twin Lab, Ayurveda & Yoga Centre, Chaat Corner, City Hospital, Temple & Community Hall, Sweet & Bakery, Cineplex. Every building (except the open-air park) opens into a furnished cutaway with people inside.
- **Two kinds of day** (button in the HUD): a weekday with office hours, and a weekend with a clinic check-up, pharmacy refill, bazaar lunch, groceries, a chaat snack and a park walk.
- **More activities** you can switch on in the Twin Lab: morning yoga, gym workout (30/45 min), post-lunch walk, after-dinner stroll, grocery trip, evening walk length, and 7 to 8 meal choices per slot. Long trips are made by auto-rickshaw.
- **Twin alerts**: when the 2-hour forecast says a spike is likely, a toast appears with what a 15-minute walk would change, and Asha's halo turns red.
- **Live stats**: steps, sitting time, carbs eaten, time in range so far, alerts.
- **Rank the best single changes**: the twin simulates every single swap or activity and ranks them by time-in-range gain; apply one, or combine the top three from different areas.
- Gym and yoga are mapped to assumed exercise intensities (0.7 and 0.35 on the model's 0-1 scale); they are not fitted.

## A different day every day
The HUD's day selector switches between seven days, each with its own activities and its own scenario:
| Day | Theme | Unique activities | What goes wrong |
|---|---|---|---|
| Mon | Control day | the normal workday | nothing (the baseline) |
| Tue | Fitness day | morning yoga, 45-min strength session, grocery run | post-workout pastry logged as small |
| Wed | Festival day | morning puja and parikrama, festival lunch, evening aarti | double thali, unlogged prasad |
| Thu | Deadline day | working through lunch, pizza at the desk | stress hormones, 105 g of carbs in one sitting |
| Fri | Movie night | Cineplex, midnight snack at home | popcorn and cola, unlogged chips |
| Sat | Wedding day | clinic check-up, wedding buffet, dancing | 150 g buffet, a false low at 2 am |
| Sun | Sick Sunday | morning walk, brunch, family feast | illness lowers insulin sensitivity |
Each day opens with a story card and a toast; the Twin Lab's "The whole week" table runs all seven days with and without the twin guard and can be downloaded as a CSV. Control days (no incidents) raised no false alarms.

## Risk day: what can go wrong, and what the twin catches
In the Twin Lab, tick incidents and press "Play this risky day" (Guard button in the HUD switches the twin's guard on and off):
- 🍰 **Unlogged office-party cake**: the CGM rises faster than the logged meals explain; the guard flags probable unlogged carbs and sends Asha on a walk.
- 🤒 **Sick day**: insulin sensitivity drops; after the first meal the twin sees glucose running above what the meals explain, flags a change in her body and sends her home to rest.
- 🍛 **Heavy late dinner + dessert** and 🥘 **festival double-thali lunch**: the guard forecasts the danger zone at the moment the meal is logged and halves the portion, skips dessert and adds a walk.
- 🛕 **Festival prasad** (unlogged sweets at the temple), 🥐 **pastry and juice logged as a small one** (the twin notices the glucose says about twice the carbs and estimates the real amount), 🎬 **movie-night popcorn and cola** (forecast at the moment it is logged), 🧊 **a frozen CGM** (flat reading while the twin expects a swing; she is falsely reassured and treats herself), 😰 **a stressful deadline** (insulin sensitivity drops in the afternoon; the twin flags it and prescribes a break and a walk).
- 🍕 **Skipped lunch then a huge desk pizza**, 💒 **wedding buffet**, 🌙 **midnight chips and cola** (unlogged) and 💊 **a forgotten morning tablet** (an assumed 22% drop in insulin sensitivity; medication is not otherwise modelled).
- 📟 **False low from a sensor glitch**: an abrupt drop the twin cannot explain is flagged as a probable sensor artifact (re-check with a fingerstick), so she does not treat a low that is not real.
With the guard off, nothing warns her: a red banner and screen vignette show when glucose passes 250 and 300 mg/dL. A table in the Lab lists, per incident, the alert time, the warning lead time, and minutes above 250 and peak without the twin versus with it. These are real outputs of the model, not scripted. There are fourteen incidents. The pizza and wedding buffet are caught at the moment they are logged; the midnight snack is only caught half an hour late and a forgotten tablet is too small a shift to matter here. The effect is large for the meal incidents (festival lunch, late dinner, movie night), moderate for prasad, the pastry and stress, modest for the unlogged cake (the twin only sees it after the rise starts) and the sick day (the twin can only see the body change once she eats); the frozen sensor shows no danger in this simulated patient (the risk is false reassurance), and the false-low case is about avoiding a needless treatment. The City Hospital is where the alert text sends her if glucose stays above 300 or she feels very unwell. No false alarms fired on usual weekday or weekend runs in testing. Incidents are weekday-only and meant one at a time; combinations interact. Medication, hydration and ketones are not modelled; the doctor advice in the alerts is generic, not medical advice.

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
