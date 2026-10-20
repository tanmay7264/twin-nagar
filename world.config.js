// Twin Nagar: a dense Indian city district where a glucose digital twin lives a day-to-day life.
// Grid 64 x 64: 4 x 4 blocks of ~12.4 units separated by 3.2-wide roads (centre lines x = 16, 32, 48; z = 16, 32, 48). Doors face +z (south).
export const GRID = {
  FH: 2.4,                               // storey height
  colx: [8.2, 24, 39.8, 55.6],           // block centre x
  rowb: [14.4, 30.4, 46, 62],            // block bottom (south edge) z
  roadsV: [16, 32, 48], roadsH: [16, 32, 48], roadW: 3.2,
  blockX: [[2, 14.4], [17.6, 30.4], [33.6, 46.4], [49.6, 62]], blockZ: [[2, 14.4], [17.6, 30.4], [33.6, 46], [49.6, 62]],
  hLines: [13.9, 29.9, 45.5, 61.5],            // pedestrian lines along each block row's south sidewalk
  vLines: [13.8, 18.2, 29.8, 34.2, 45.8, 50.2],   // pedestrian lines along the vertical streets
};
const place = (r, c, w, d) => ({ x: GRID.colx[c], z: GRID.rowb[r] - 1.6 - d / 2, w, d });
export const WORLD = {
  title: 'Twin Nagar',
  intro: 'A busy city district where Asha (58, type 2 diabetes) lives her day with a glucose digital twin. Follow her: buildings open up when she walks in. Then use the Twin Lab to try a healthier day before she does.',
  size: 64, depth: 64,
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
    { id: 'hospital', name: 'City Hospital', kicker: 'IF IT GETS SERIOUS', ...place(3, 0, 9, 6.4), floors: 2, color: '#D64545', wall: '#F6E1E1', roof: 'flat', blurb: 'Where the twin sends Asha when glucose stays above 300 or she feels very unwell (thirst, vomiting, drowsiness). Emergency bay downstairs, ward upstairs.', facts: [['Twin rule', 'Persistent >300 or symptoms: go']], inside: ['Ground floor: emergency bay with monitors, a doctor and a nurse', 'First floor: ward beds with IV stands'] },
    { id: 'temple', name: 'Temple & Community Hall', kicker: 'FESTIVAL PRASAD', ...place(3, 1, 8, 6), floors: 1, color: '#E08A1E', wall: '#F8E7C9', blurb: 'Evening aarti and a plate of prasad. Offered sweets are easy to forget to log: four laddus and a bowl of payasam can be 115 g of carbohydrate.', facts: [['Risk', 'Unlogged sweets']], inside: ['An altar with oil lamps, devotees on the carpet, a prasad plate'] },
    { id: 'bakery', name: 'Sweet & Bakery', kicker: 'TEMPTATION', ...place(3, 2, 7, 5.6), floors: 1, color: '#C2557A', wall: '#F6DCE4', blurb: 'Cakes, pastries and fresh juice. Portions look small and are easy to under-log: a pastry and a juice can be twice what you wrote down.', facts: [['Risk', 'Under-logged portion']], inside: ['Display cases of cakes and pastries, a baker at the oven'] },
    { id: 'cinema', name: 'Cineplex', kicker: 'MOVIE NIGHT', ...place(3, 3, 9, 6.4), floors: 1, color: '#34495E', wall: '#DCE1E8', roof: 'flat', blurb: 'Three hours sitting in the dark with a large popcorn and a cola: about 100 g of fast carbohydrate right before bed.', facts: [['Risk', 'Heavy late snack']], inside: ['A screen, rows of seats with an audience, popcorn in every lap'] },
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
    'Moong dal chilla x2': [28, 16, 8, 6], 'Black coffee (strong)': [1, 0.3, 0, 0], 'Water + ORS (sugar-free)': [0.5, 0, 0, 0], 'Roti x2 + dal + sabzi': [55, 16, 10, 9], 'White rice 1 cup + dal + sabzi': [70, 14, 8, 6],
    'Brown rice + dal + sabzi': [60, 15, 8, 9], 'Ragi roti x2 + dal': [50, 13, 6, 9], 'Jowar roti x2 + sabzi': [45, 10, 6, 8],
    'Veg biryani (1 plate)': [80, 12, 18, 5], 'Curd rice': [45, 8, 6, 1], 'Biscuits + chai': [25, 3, 6, 1], 'Banana': [27, 1, 0, 3],
    'Sprouts chaat': [20, 10, 2, 7], 'Sweets x2 (mithai)': [35, 3, 12, 0], 'Aloo paratha x2': [68, 9, 18, 5],
    'Samosa x2': [32, 6, 17, 3], 'Deadline pizza and cola': [105, 14, 28, 4], 'Wedding buffet (biryani, sweets, soft drink)': [150, 14, 38, 6], 'Late-night chips and cola': [60, 4, 22, 3], 'Family feast (biryani, raita, sweets)': [95, 14, 26, 5], 'Festival prasad (laddus)': [115, 6, 30, 2], 'Pastry and fruit juice': [85, 4, 16, 1], 'Large popcorn + cola': [105, 3, 14, 5], 'Office party cake and cola': [110, 6, 28, 1], 'Festival thali (2 servings)': [125, 22, 28, 12], 'Juice (treating a false low)': [30, 0, 0, 0], 'Pani puri (6 pcs)': [30, 3, 6, 2], 'Vada pav': [45, 6, 13, 3],
  },
  slots: {
    breakfast: ['Masala dosa', 'Idli x3 + sambar', 'Poha (1 plate)', 'Upma (1 bowl)', 'Moong dal chilla x2', 'Ragi roti x2 + dal', 'Aloo paratha x2'],
    lunch: ['White rice 1 cup + dal + sabzi', 'Brown rice + dal + sabzi', 'Roti x2 + dal + sabzi', 'Ragi roti x2 + dal', 'Jowar roti x2 + sabzi', 'Veg biryani (1 plate)', 'Curd rice', 'Moong dal chilla x2', 'Family feast (biryani, raita, sweets)'],
    snack: ['Biscuits + chai', 'Samosa x2', 'Pani puri (6 pcs)', 'Vada pav', 'Sprouts chaat', 'Banana', 'Sweets x2 (mithai)', null],
    dinner: ['Roti x2 + dal + sabzi', 'Jowar roti x2 + sabzi', 'Ragi roti x2 + dal', 'White rice 1 cup + dal + sabzi', 'Idli x3 + sambar', 'Moong dal chilla x2', null],
  },
  // seven different days; every plan field is something the Twin Lab can change. day 0..6 = Monday..Sunday.
  usualFor: d => { const i = d === 'weekend' ? 5 : typeof d === 'number' ? d : 0; return { ...BASE_PLAN, ...DAYS[i].preset, day: i }; },
};
const BASE_PLAN = { breakfast: 'Masala dosa', lunch: 'White rice 1 cup + dal + sabzi', snack: 'Biscuits + chai', dinner: 'Roti x2 + dal + sabzi', lunchWalk: false, eveWalk: 30, yoga: false, gym: 0, groceries: false, stroll: false, puja: false };
export const DAYS = [
  { id: 'mon', name: 'Monday', theme: 'Control day', blurb: 'A normal workday with nothing unusual: the baseline the twin is calibrated on.', preset: {}, incidents: [],
    unique: ['Café breakfast, desk work, bazaar lunch, evening walk at Lake Park'], risks: ['None on purpose. Use it to compare every other day.'] },
  { id: 'tue', name: 'Tuesday', theme: 'Fitness day', blurb: 'Asha goes all in: morning yoga, a strength session at the gym and a grocery run. Then the bakery calls on the way home.',
    preset: { yoga: true, gym: 45, groceries: true, lunchWalk: true, eveWalk: 0, snack: 'Banana' }, incidents: ['pastry'],
    unique: ['35-minute morning yoga at the Ayurveda & Yoga Centre', '45-minute gym workout', 'Grocery run at Fresh Mart', 'Post-lunch walk'], risks: ['A post-workout pastry and juice logged as "small": under-logged carbs'] },
  { id: 'wed', name: 'Wednesday', theme: 'Festival day', blurb: 'A festival: morning puja at the temple, a double festival lunch, and prasad at the evening aarti.',
    preset: { puja: true, breakfast: 'Idli x3 + sambar', eveWalk: 0 }, incidents: ['doubleLunch', 'prasad'],
    unique: ['Morning puja and parikrama at the temple', 'Festival thali for lunch', 'Evening aarti and prasad'], risks: ['Double thali lunch (about 125 g carbs)', 'Four laddus and payasam that nobody logs'] },
  { id: 'thu', name: 'Thursday', theme: 'Deadline day', blurb: 'A product launch. No time for lunch, a stressful afternoon, then a huge pizza at the desk and a late dinner.',
    preset: { breakfast: 'Upma (1 bowl)', snack: null, eveWalk: 0, dinner: 'Moong dal chilla x2' }, incidents: ['stress', 'pizza'],
    unique: ['Working through lunch at the desk', 'Pizza and cola at 16:45', 'Late dinner at home'], risks: ['Stress hormones lift glucose in the afternoon', 'About 105 g of carbs in one sitting after skipping lunch'] },
  { id: 'fri', name: 'Friday', theme: 'Movie night', blurb: 'The week is done: a Cineplex night with popcorn and cola, then midnight chips on the sofa.',
    preset: { eveWalk: 0 }, incidents: ['movie', 'nightSnack'],
    unique: ['Movie at the Cineplex, 20:00 to 22:30', 'A midnight snack at home'], risks: ['A 105 g popcorn and cola, three hours seated', 'Late chips and cola nobody logs'] },
  { id: 'sat', name: 'Saturday', theme: 'Wedding day', blurb: 'A morning check-up at the clinic, a light lunch at home, then a wedding at the community hall: buffet, dancing, a late night.',
    preset: { breakfast: 'Aloo paratha x2', lunch: 'Moong dal chilla x2', snack: null, dinner: null, eveWalk: 0 }, incidents: ['wedding', 'sensor'],
    unique: ['Clinic check-up and CGM review', 'Wedding at the Temple & Community Hall', 'Dancing for 25 minutes', 'Overnight, the sensor misbehaves'], risks: ['A 150 g wedding buffet with sweets and soft drink', 'A false low at 2 am from a pressed sensor'] },
  { id: 'sun', name: 'Sunday', theme: 'Sick Sunday', blurb: 'Asha wakes up unwell but keeps the routine: a 45-minute morning walk, brunch at the café, a big family lunch. Her body responds differently today.',
    preset: { breakfast: 'Poha (1 plate)', lunch: 'Family feast (biryani, raita, sweets)', snack: null, dinner: 'Moong dal chilla x2', groceries: true, eveWalk: 0 }, incidents: ['sick'],
    unique: ['45-minute walk at Lake Park', 'Brunch at the café', 'Family feast at home', 'Grocery run'], risks: ['Illness lowers insulin sensitivity; the twin has to notice from the numbers'] },
  // special scenario days (weekday routine plus one non-food cause of high glucose that the twin has to recognise from context)
  { id: 'heat', name: 'Heatwave', short: '★', theme: 'Heatwave & dehydration', blurb: 'A 41°C day. Asha walks to the bazaar and back in the sun and drinks only one glass of water. Losing plasma water concentrates her glucose, and high glucose makes her lose more water.',
    preset: { lunchWalk: true }, incidents: ['heat'],
    unique: ['Hot walk to the bazaar and a post-lunch walk in the sun', 'Office in the afternoon heat', 'Evening walk planned at Lake Park'], risks: ['Dehydration raises glucose concentration with no extra food', 'A vicious circle: high glucose means more urine and more water loss'] },
  { id: 'coffee', name: 'Coffee day', short: '★', theme: 'Caffeine overload', blurb: 'A long day fuelled by strong black coffee: one at the café, two at the desk before lunch, one more at 15:30. No sugar, yet lunch hits harder than usual.',
    preset: {}, incidents: ['caffeine'],
    unique: ['Four strong black coffees (no sugar)', 'Usual breakfast, lunch and evening walk'], risks: ['Caffeine lowers insulin sensitivity for hours, so the same lunch spikes higher'] },
  { id: 'hiit', name: 'Training day', short: '★', theme: 'Heavy exercise', blurb: 'Asha tries a high-intensity class: sprints and heavy lifting at the gym after work. Her glucose goes up during the workout, not down.',
    preset: { gym: 45, eveWalk: 0 }, incidents: ['heavyEx'],
    unique: ['45-minute HIIT and heavy lifting session at the Community Gym'], risks: ['Adrenaline releases liver glucose during hard exercise', 'Misreading it as food, or panicking and taking an extra tablet'] },
  { id: 'late', name: 'Late day', short: '★', theme: 'Late & stuck in traffic', blurb: 'Asha oversleeps, skips the café, and sits in a taxi stuck in traffic for almost an hour, anxious about a 9:30 meeting. Her glucose rises with no food at all.',
    preset: { eveWalk: 30 }, incidents: ['commute'],
    unique: ['Wakes at 8:05 and rushes out', 'Taxi stuck in traffic', 'Product review at 9:30, breakfast at the desk at 11:05'], risks: ['Adrenaline and cortisol raise glucose without food', 'A grab-and-go vada pav breakfast on top of it'] },
];

CITY.usual = CITY.usualFor(0);   // the Monday baseline
