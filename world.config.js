// Twin Nagar: a dense Indian city district where a glucose digital twin lives a day-to-day life.
// Grid 64 wide x 48 deep: 4 x 3 blocks of ~12.4 units separated by 3.2-wide roads (centre lines x = 16, 32, 48; z = 16, 32). Doors face +z (south).
export const GRID = {
  FH: 2.4,                               // storey height
  colx: [8.2, 24, 39.8, 55.6],           // block centre x
  rowb: [14.4, 30.4, 46],                // block bottom (south edge) z
  roadsV: [16, 32, 48], roadsH: [16, 32], roadW: 3.2,
  blockX: [[2, 14.4], [17.6, 30.4], [33.6, 46.4], [49.6, 62]], blockZ: [[2, 14.4], [17.6, 30.4], [33.6, 46]],
  hLines: [13.9, 29.9, 45.5],            // pedestrian lines along each block row's south sidewalk
  vLines: [13.8, 18.2, 29.8, 34.2, 45.8, 50.2],   // pedestrian lines along the vertical streets
};
const place = (r, c, w, d) => ({ x: GRID.colx[c], z: GRID.rowb[r] - 1.6 - d / 2, w, d });
export const WORLD = {
  title: 'Twin Nagar',
  intro: 'A busy city district where Asha (58, type 2 diabetes) lives her day with a glucose digital twin. Follow her: buildings open up when she walks in. Then use the Twin Lab to try a healthier day before she does.',
  size: 64, depth: 48,
  seed: 21,
  trees: 0,
  colors: {
    ground: '#C9CCD2', trim: '#8A8F99', floor: '#E6EBE6', haze: '#E4E9F0', path: '#EADFC9',
    accent: '#0F8B8D', foliage: ['#6FA347', '#7DB04E', '#5E9A3E', '#8DBA4E'],
  },
  areas: [], paths: [],
  zones: [
    { id: 'home', name: 'Home', kicker: 'MORNING AND EVENING', ...place(0, 0, 8, 6.4), floors: 2, color: '#F0973A', wall: '#F6E3CC', blurb: 'A two-storey apartment. Asha has chai in the kitchen, dinner at the dining table, TV on the sofa, and sleeps upstairs. The twin reads her sleep as the long overnight fast.', facts: [['Role', 'Fasting baseline, dinner']], inside: ['Ground floor: kitchen, dining table, living room with TV', 'First floor: bedroom (Asha sleeps here), wardrobe, glucometer by the bed'] },
    { id: 'cafe', name: 'Udupi Café', kicker: 'BREAKFAST', ...place(0, 1, 7, 5.6), floors: 1, color: '#D9693A', wall: '#F3DCC8', blurb: 'The first big carbohydrate load of the day. Idli, dosa and poha digest at different speeds, so the same café gives very different glucose curves.', facts: [['Usual', 'Masala dosa, 60 g carbs']], inside: ['Chef at the steamer and tawa behind the counter', 'Regulars at the tables; steam from the idli plates'] },
    { id: 'pharmacy', name: 'Medplus Pharmacy', kicker: 'REFILLS (WEEKEND)', ...place(0, 2, 7, 5.6), floors: 1, color: '#2E7D6B', wall: '#E3F1EC', roof: 'flat', blurb: 'Weekend refills of tablets and test strips. A reminder that the twin does not model medication: it only sees carbohydrate and walking.', facts: [['Not modelled', 'Medication']], inside: ['Pharmacist at the counter, shelves of medicines', 'A glucometer and test-strip display'] },
    { id: 'office', name: 'Tech Office', kicker: 'DESK HOURS', ...place(0, 3, 9, 6.8), floors: 3, color: '#3E7CB1', wall: '#E3EAF2', roof: 'flat', blurb: 'Hours of sitting. Almost no exercise effect on glucose uptake, plus a 4:30 biscuit-and-chai habit.', facts: [['Usual', 'Desk 9-1 and 2:30-5:15']], inside: ['Ground floor: reception and lobby', 'First floor: open-plan desks (Asha works here)', 'Second floor: pantry and meeting room'] },
    { id: 'clinic', name: 'Happiest Health Clinic', kicker: 'CHECK-UPS (WEEKEND)', ...place(1, 0, 8, 6.4), floors: 2, color: '#2F9E8F', wall: '#E2F0EE', roof: 'flat', blurb: 'Where the twin is calibrated: a 14-day CGM patch plus HbA1c and fasting bloods set the starting prior. On weekends Asha comes for a check-up.', facts: [['Calibration', '14-day CGM + labs'], ['HbA1c', '7.2%']], inside: ['Ground floor: reception, waiting area, HbA1c analyser', 'First floor: consultation room with a CGM reader, lab bench'] },
    { id: 'park', name: 'Lake Park', kicker: 'EVENING WALK', x: 24, z: 24, w: 4, d: 3.2, floors: 1, color: '#4CA96A', wall: '#EFE9D8', roof: 'flat', open: true, blurb: 'A jogging loop around a pavilion. Walking raises insulin-independent glucose uptake, which the twin models as an exercise term.', facts: [['Usual', '30 min walk']], inside: ['Open-air pavilion with benches; the track is the loop Asha walks'] },
    { id: 'mart', name: 'Fresh Mart', kicker: 'GROCERIES', ...place(1, 2, 10, 6.4), floors: 1, color: '#D79B1E', wall: '#F6EBC8', blurb: 'A supermarket trip on the way home. Walking the aisles is light activity, and what goes in the trolley (ragi atta, brown rice, millets) decides next week\'s meals.', facts: [['Usual', 'Optional evening stop']], inside: ['Aisles of grain, pulses and fruit, a trolley, a cashier'] },
    { id: 'market', name: 'Bazaar Lunch', kicker: 'LUNCH', ...place(1, 3, 9, 6), floors: 1, color: '#C9372C', wall: '#F5DDD6', blurb: 'Thali and street food. The usual white-rice lunch is the biggest, fastest carbohydrate hit of her day.', facts: [['Usual', 'White rice + dal, 70 g carbs']], inside: ['Three food stalls with cooks, shared tables, a thali on every tray'] },
    { id: 'gym', name: 'Community Gym', kicker: 'OPTIONAL WORKOUT', ...place(2, 0, 8, 6), floors: 1, color: '#8D63B8', wall: '#E9E1F2', roof: 'flat', blurb: 'An optional evening workout in the Twin Lab plan. The twin treats it as a higher exercise term than a walk (an assumption).', facts: [['Modelled as', 'Exercise term (assumed)']], inside: ['Treadmills with runners, a weight bench, a trainer'] },
    { id: 'lab', name: 'Twin Lab', kicker: 'TRY IT ON THE TWIN FIRST', ...place(2, 1, 8, 6.4), floors: 2, color: '#66518A', wall: '#E6E1F0', roof: 'flat', blurb: 'Swap meals, add walks, a workout or yoga, drop the biscuit, then compare the whole day on Asha\'s twin before she tries it. Or let the twin rank the best single changes.', facts: [['Engine', 'Same ODE as the research twin']], inside: ['Ground floor: a holographic table drawing Asha\'s current day', 'First floor: servers and data walls'] },
    { id: 'ayur', name: 'Ayurveda & Yoga Centre', kicker: 'MORNING YOGA', ...place(2, 2, 7, 5.6), floors: 1, color: '#B8863B', wall: '#F2E6CF', blurb: 'An optional 35-minute morning yoga class. The twin models it as gentle exercise; stress and sleep benefits are not modelled.', facts: [['Modelled as', 'Gentle exercise (assumed)']], inside: ['A yoga class on mats led by an instructor, herbs on the shelves'] },
    { id: 'chaat', name: 'Chaat Corner', kicker: 'WEEKEND SNACK', ...place(2, 3, 6, 5), floors: 1, color: '#D9482B', wall: '#F7DAD0', blurb: 'The weekend snack stop. Samosa, pani puri and vada pav are fast, fried carbohydrates: a classic test for the twin.', facts: [['Usual', 'Samosa x2, 32 g carbs']], inside: ['A fryer and a pani-puri stall, customers on stools'] },
  ],
};

// ---- the person and her twin
// Parameters are the calibrated posterior of CGMacros participant C049 (58 F, BMI 36, HbA1c 7.2%) from the research twin:
// SI (insulin sensitivity), SG (glucose effectiveness), k (carb absorption). sd = log-space posterior widths. Fasting baseline gb mg/dL.
export const CITY = {
  person: { name: 'Asha', age: 58, line: 'Type 2 diabetes · HbA1c 7.2% · calibrated on real CGM data (participant C049)' },
  twin: { th: [0.0003325094153252629, 0.00100000000000005, 0.01714926528792129], sd: [0.0518, 0.9325, 0.0169], gb: 126 },
  minPerUnit: 0.75,             // simulated minutes to walk one grid unit
  // name: [carbs g, protein g, fat g, fibre g]  (approximate per serving; verify against IFCT 2017)
  meals: {
    'Idli x3 + sambar': [42, 9, 3, 4], 'Masala dosa': [60, 8, 12, 4], 'Poha (1 plate)': [50, 6, 8, 3], 'Upma (1 bowl)': [45, 7, 9, 3],
    'Moong dal chilla x2': [28, 16, 8, 6], 'Roti x2 + dal + sabzi': [55, 16, 10, 9], 'White rice 1 cup + dal + sabzi': [70, 14, 8, 6],
    'Brown rice + dal + sabzi': [60, 15, 8, 9], 'Ragi roti x2 + dal': [50, 13, 6, 9], 'Jowar roti x2 + sabzi': [45, 10, 6, 8],
    'Veg biryani (1 plate)': [80, 12, 18, 5], 'Curd rice': [45, 8, 6, 1], 'Biscuits + chai': [25, 3, 6, 1], 'Banana': [27, 1, 0, 3],
    'Sprouts chaat': [20, 10, 2, 7], 'Sweets x2 (mithai)': [35, 3, 12, 0], 'Aloo paratha x2': [68, 9, 18, 5],
    'Samosa x2': [32, 6, 17, 3], 'Office party cake and cola': [110, 6, 28, 1], 'Festival thali (2 servings)': [125, 22, 28, 12], 'Juice (treating a false low)': [30, 0, 0, 0], 'Pani puri (6 pcs)': [30, 3, 6, 2], 'Vada pav': [45, 6, 13, 3],
  },
  slots: {
    breakfast: ['Masala dosa', 'Idli x3 + sambar', 'Poha (1 plate)', 'Upma (1 bowl)', 'Moong dal chilla x2', 'Ragi roti x2 + dal', 'Aloo paratha x2'],
    lunch: ['White rice 1 cup + dal + sabzi', 'Brown rice + dal + sabzi', 'Roti x2 + dal + sabzi', 'Ragi roti x2 + dal', 'Jowar roti x2 + sabzi', 'Veg biryani (1 plate)', 'Curd rice'],
    snack: ['Biscuits + chai', 'Samosa x2', 'Pani puri (6 pcs)', 'Vada pav', 'Sprouts chaat', 'Banana', 'Sweets x2 (mithai)', null],
    dinner: ['Roti x2 + dal + sabzi', 'Jowar roti x2 + sabzi', 'Ragi roti x2 + dal', 'White rice 1 cup + dal + sabzi', 'Idli x3 + sambar'],
  },
  // two kinds of day; every plan field is something the Twin Lab can change
  usualFor: kind => kind === 'weekend'
    ? { dayType: 'weekend', breakfast: 'Aloo paratha x2', lunch: 'Veg biryani (1 plate)', snack: 'Samosa x2', dinner: 'Roti x2 + dal + sabzi', lunchWalk: false, eveWalk: 30, yoga: false, gym: 0, groceries: true, stroll: false }
    : { dayType: 'weekday', breakfast: 'Masala dosa', lunch: 'White rice 1 cup + dal + sabzi', snack: 'Biscuits + chai', dinner: 'Roti x2 + dal + sabzi', lunchWalk: false, eveWalk: 30, yoga: false, gym: 0, groceries: false, stroll: false },
};

CITY.usual = CITY.usualFor("weekday");   // the weekday baseline
