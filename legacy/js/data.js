/* Ozone Scents — seed catalogue & reference data.
   Sources: Catalogue/Ozone_Scents_Diffuser_Catalogue_Redesigned_compressed.pdf (diffusers, prices, specs)
            Catalogue/Aroma Nature Oil (1)_compressed.pdf (oils, prices, guidelines, company details)
   Everything here is the "server" seed; admin edits are persisted on top of it by store.js. */
window.OZ = window.OZ || {};

OZ.BRAND = {
  name: 'Ozone Scents',
  legalName: 'Aroma Ozone Scents LLC',
  tagline: 'The Architecture of Olfactory Luxury',
  phone: '+971 52 626 6873',
  phoneRaw: '971526266873',
  phone2: '+971 54 724 9877',
  phone2Raw: '971547249877',
  email: 'info@ozonescents.com',
  salesEmail: 'Sales@aromaozonescents.com',
  website: 'www.ozonescents.com',
  address: 'Media City, Sharjah, United Arab Emirates',
  mapQuery: 'Sharjah Media City, Sharjah, United Arab Emirates'
};

OZ.CURRENCIES = {
  AED: { rate: 1, label: 'AED' },
  USD: { rate: 0.2723, label: 'USD' },
  EUR: { rate: 0.2495, label: 'EUR' },
  SAR: { rate: 1.0211, label: 'SAR' },
  GBP: { rate: 0.2076, label: 'GBP' }
};

OZ.LANGS = {
  en: { label: 'English', short: 'ENG', dir: 'ltr', locale: 'en-AE' },
  es: { label: 'Español', short: 'ESP', dir: 'ltr', locale: 'es-ES' },
  ar: { label: 'العربية', short: 'عربي', dir: 'rtl', locale: 'ar-AE-u-nu-latn' }
};

/* Product types (drive the "Diffuser Machines" sub-menu and filters) */
OZ.TYPES = ['tower', 'hvac', 'wall', 'portable', 'car', 'oil'];
OZ.DIFFUSER_TYPES = ['tower', 'hvac', 'wall', 'portable', 'car'];
OZ.FAMILIES = ['citrus', 'floral', 'fresh', 'woody'];
OZ.SPACES = ['home', 'office', 'commercial', 'car'];
OZ.FEATURES = ['app', 'bluetooth', 'timer', 'led', 'quiet', 'energy', 'tank', 'wallMount', 'battery', 'hvac', 'plant', 'waterless'];
/* Images available to the admin "choose from library" picker */
OZ.IMAGE_LIBRARY = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10'].concat(
  ['ozone-scent', 'fitboost', 'veloura', 'address', 'deep-sea', 'elegant-her', 'candy-kiss', 'prestige', 'root-earth', 'ginger-mist', 'blue-water', 'zestora',
   'velvet-bloom', 'love-whisper', 'lemon-breeze', 'candle-light', 'address-hotel', 'rove-hotel', 'ritz-carlton-hotel', 'versace-hotel'].map(k => 'oil-' + k));

/* Collections reachable from the navigation */
OZ.COLLECTIONS = {
  diffusers:     { match: p => p.type !== 'oil' },
  oils:          { match: p => p.type === 'oil' },
  signature:     { match: p => p.type === 'oil' && p.line === 'signature' },
  hotel:         { match: p => p.type === 'oil' && p.line === 'hotel' },
  'home-care':   { match: p => p.type !== 'oil' && p.spaces.includes('home') },
  'aroma-deals': { match: p => p.type === 'oil' },
  'crazy-deals': { match: p => p.compareAt > p.price },
  gifts:         { match: p => p.giftable },
  bestsellers:   { match: p => p.bestSeller }
};

OZ.discountPct = p => p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;

/* ---------- diffuser machines (catalogue pages 4–8) ---------- */
const T = (en, es, ar) => ({ en, es, ar });
const diffuser = d => Object.assign({
  compareAt: 0, stock: 25, rating: 0, reviewCount: 0, bestSeller: false, aromaDeal: false, isNew: false,
  family: null, notes: { top: [], heart: [], base: [] }, gallery: []
}, d);

OZ.SEED_PRODUCTS = [
  diffuser({
    id: 'car-diffuser', sku: 'OZ-CAR', img: 'o7', type: 'car', spaces: ['car'], giftable: true,
    price: 270, sizes: [{ id: '15', ml: 15, delta: 0 }],
    features: ['energy', 'timer'],
    specs: [['spec.refill', 'Fragrance oil'], ['spec.capacity', '15 ml'], ['spec.power', '1.5 W (low energy consumption), 5 V'], ['spec.dims', 'Ø 9 × 129 mm'], ['spec.weight', '314 g'], ['spec.consumption', '0.03 – 0.15 g/h'], ['spec.material', 'PP + Aluminium']],
    ideal: T('Cars', 'Coches', 'السيارات'),
    name: T('Ozone Scents Car Diffuser', 'Difusor para Coche Ozone Scents', 'ناشر أوزون سنتس للسيارة'),
    tagline: T('Compact, low-energy scenting for your car.', 'Aromatización compacta y de bajo consumo para tu coche.', 'تعطير صغير الحجم وموفّر للطاقة لسيارتك.'),
    desc: T(
      'A sleek aluminium car diffuser with mode and timer controls. Its 15 ml fragrance-oil bottle and 1.5 W power draw keep your car scented on every drive.',
      'Un elegante difusor de aluminio para coche con controles de modo y temporizador. Su frasco de 15 ml y su consumo de 1,5 W mantienen tu coche aromatizado en cada trayecto.',
      'ناشر أنيق من الألمنيوم للسيارة مع أزرار للوضع والمؤقّت. زجاجة الزيت سعة 15 مل واستهلاك 1.5 واط يحافظان على عطر سيارتك في كل رحلة.')
  }),
  diffuser({
    id: 'handy-diffuser', sku: 'OZ-HANDY', img: 'o2', type: 'portable', spaces: ['home'], giftable: true,
    price: 280, sizes: [{ id: '200', ml: 200, delta: 0 }],
    features: ['bluetooth', 'quiet'],
    specs: [['spec.capacity', '200 ml'], ['spec.voltage', '1.5 V / 3 V / 5 V'], ['spec.weight', '0.5 kg'], ['spec.noise', '< 35 dBA'], ['spec.connectivity', 'Bluetooth']],
    ideal: T('Bedrooms, bathrooms and small rooms', 'Dormitorios, baños y estancias pequeñas', 'غرف النوم والحمّامات والغرف الصغيرة'),
    name: T('Ozone Handy Diffuser', 'Difusor Handy Ozone', 'ناشر أوزون هاندي'),
    tagline: T('Quiet, Bluetooth-operated scenting in a compact shell.', 'Aromatización silenciosa con Bluetooth en un formato compacto.', 'تعطير هادئ يعمل عبر البلوتوث بتصميم صغير.'),
    desc: T(
      'The Handy Diffuser holds 200 ml of oil, runs below 35 dBA and is operated over Bluetooth — an easy way to scent smaller spaces.',
      'El Difusor Handy contiene 200 ml de aceite, funciona por debajo de 35 dBA y se maneja por Bluetooth: una forma sencilla de aromatizar espacios pequeños.',
      'يتسع ناشر هاندي لـ 200 مل من الزيت ويعمل بأقل من 35 ديسيبل ويُشغَّل عبر البلوتوث — طريقة سهلة لتعطير المساحات الصغيرة.')
  }),
  diffuser({
    id: 'bath-diffuser', sku: 'OZ-BATH', img: 'o3', type: 'wall', spaces: ['home', 'office'], giftable: true,
    price: 270, sizes: [{ id: '150', ml: 150, delta: 0 }],
    features: ['wallMount'],
    specs: [['spec.capacity', '150 ml'], ['spec.weight', '345 g'], ['spec.coverage', '100 – 300 m³'], ['spec.mounting', 'Desktop or wall mounted'], ['spec.workingTime', '10 hours per day']],
    ideal: T('Washrooms and elevators', 'Aseos y ascensores', 'دورات المياه والمصاعد'),
    name: T('Ozone Bath Diffuser', 'Difusor de Baño Ozone', 'ناشر أوزون للحمّام'),
    tagline: T('Desktop or wall-mounted scenting for washrooms and lifts.', 'Aromatización de sobremesa o pared para aseos y ascensores.', 'تعطير مكتبي أو جداري لدورات المياه والمصاعد.'),
    desc: T(
      'A soft-touch black unit that sits on a counter or mounts on the wall. It covers 100–300 m³ and is built to run 10 hours a day.',
      'Una unidad negra de tacto suave que se coloca sobre una encimera o se instala en la pared. Cubre de 100 a 300 m³ y está pensada para funcionar 10 horas al día.',
      'وحدة سوداء ناعمة الملمس توضع على السطح أو تُثبّت على الجدار. تغطي من 100 إلى 300 م³ ومصممة للعمل 10 ساعات يوميًا.')
  }),
  diffuser({
    id: 'love-diffuser', sku: 'OZ-LOVE', img: 'o10', type: 'wall', spaces: ['home', 'office'], giftable: true,
    price: 460, sizes: [{ id: '150', ml: 150, delta: 0 }],
    features: ['wallMount'],
    specs: [['spec.capacity', '150 ml'], ['spec.coverage', '100 – 300 m³'], ['spec.mounting', 'Wall mounted']],
    ideal: T('Small rooms, small corridors, kitchen & pantry', 'Habitaciones y pasillos pequeños, cocina y despensa', 'الغرف والممرات الصغيرة والمطبخ وغرفة المؤن'),
    name: T('Ozone Love Diffuser', 'Difusor Love Ozone', 'ناشر أوزون لوف'),
    tagline: T('A wall-mounted diffuser for small rooms and corridors.', 'Un difusor de pared para habitaciones y pasillos pequeños.', 'ناشر جداري للغرف والممرات الصغيرة.'),
    desc: T(
      'The Love Diffuser mounts neatly on the wall and scents 100–300 m³ from a 150 ml bottle — ideal for small rooms, corridors, kitchens and pantries.',
      'El Difusor Love se instala en la pared y aromatiza de 100 a 300 m³ con un frasco de 150 ml: ideal para habitaciones pequeñas, pasillos, cocinas y despensas.',
      'يُثبَّت ناشر لوف على الجدار بأناقة ويعطّر من 100 إلى 300 م³ من زجاجة سعة 150 مل — مثالي للغرف الصغيرة والممرات والمطابخ.')
  }),
  diffuser({
    id: 'home-diffuser', sku: 'OZ-HOME', img: 'o4', gallery: ['o5'], type: 'hvac', spaces: ['home', 'office', 'commercial'], giftable: false,
    price: 690, sizes: [{ id: '500', ml: 500, delta: 0 }],
    features: ['tank', 'wallMount'],
    specs: [['spec.capacity', '500 ml'], ['spec.material', 'Metal'], ['spec.weight', '4.4 kg'], ['spec.coverage', '800 – 1,000 m² (2,000 – 2,500 m³)'], ['spec.consumption', '4.5 g ± 0.5 g'], ['spec.mounting', 'Desktop, wall mounted or floor install']],
    ideal: T('Rooms, lobbies and offices', 'Salas, vestíbulos y oficinas', 'الغرف والردهات والمكاتب'),
    name: T('Ozone Home Diffuser', 'Difusor Home Ozone', 'ناشر أوزون للمنزل'),
    tagline: T('A metal-bodied machine for rooms, lobbies and offices.', 'Una máquina con cuerpo metálico para salas, vestíbulos y oficinas.', 'جهاز بهيكل معدني للغرف والردهات والمكاتب.'),
    desc: T(
      'Built in metal with a 500 ml bottle, the Home Diffuser covers 800–1,000 m² and can stand on a desk, mount on a wall or install on the floor.',
      'Fabricado en metal con un frasco de 500 ml, el Difusor Home cubre de 800 a 1.000 m² y puede colocarse sobre una mesa, en la pared o en el suelo.',
      'مصنوع من المعدن مع زجاجة سعة 500 مل، يغطي ناشر المنزل من 800 إلى 1000 م² ويمكن وضعه على المكتب أو تثبيته على الجدار أو الأرض.')
  }),
  diffuser({
    id: 'max-diffuser', sku: 'OZ-MAX', img: 'o9', type: 'hvac', spaces: ['office', 'commercial'], giftable: false,
    price: 680, sizes: [{ id: '600', ml: 600, delta: 0 }],
    features: ['led', 'tank'],
    specs: [['spec.capacity', '600 ml'], ['spec.coverage', '3,000 m³ (12,000 sq ft)'], ['spec.dims', '270 × 116 × 219 mm'], ['spec.voltage', '12 V'], ['spec.power', '17 W']],
    ideal: T('Dining areas, gyms, hospitals, small lobbies and restaurants', 'Comedores, gimnasios, hospitales, vestíbulos pequeños y restaurantes', 'مناطق الطعام والصالات الرياضية والمستشفيات والردهات الصغيرة والمطاعم'),
    name: T('Ozone Max Diffuser', 'Difusor Max Ozone', 'ناشر أوزون ماكس'),
    tagline: T('Digital-display scenting for up to 3,000 m³.', 'Aromatización con pantalla digital para hasta 3.000 m³.', 'تعطير بشاشة رقمية حتى 3000 م³.'),
    desc: T(
      'A white machine with a digital display and mode/set controls. Its 600 ml bottle scents up to 3,000 m³ — suited to restaurants, gyms and clinics.',
      'Una máquina blanca con pantalla digital y controles de modo y ajuste. Su frasco de 600 ml aromatiza hasta 3.000 m³: ideal para restaurantes, gimnasios y clínicas.',
      'جهاز أبيض بشاشة رقمية وأزرار للوضع والضبط. زجاجته سعة 600 مل تعطّر حتى 3000 م³ — مناسب للمطاعم والصالات الرياضية والعيادات.')
  }),
  diffuser({
    id: 'box-diffuser', sku: 'OZ-BOX', img: 'o6', type: 'hvac', spaces: ['home', 'office', 'commercial'], giftable: false,
    price: 790, sizes: [{ id: '1000', ml: 1000, delta: 0 }],
    features: ['app', 'tank'],
    specs: [['spec.capacity', '1,000 ml'], ['spec.material', 'Plastic'], ['spec.weight', '3.9 kg'], ['spec.coverage', '3,000 – 4,000 m³'], ['spec.power', '15 W'], ['spec.dims', '295 × 113 × 230 mm']],
    ideal: T('Offices, showrooms, living rooms and corridors', 'Oficinas, showrooms, salones y pasillos', 'المكاتب وصالات العرض وغرف المعيشة والممرات'),
    name: T('Ozone Box Diffuser', 'Difusor Box Ozone', 'ناشر أوزون بوكس'),
    tagline: T('App-controlled scenting for 3,000–4,000 m³.', 'Aromatización controlada por app para 3.000–4.000 m³.', 'تعطير يُتحكّم به عبر التطبيق لمساحات من 3000 إلى 4000 م³.'),
    desc: T(
      'The Box Diffuser pairs a 1,000 ml bottle with app control to scent 3,000–4,000 m³ — offices, showrooms, living rooms and corridors.',
      'El Difusor Box combina un frasco de 1.000 ml con control por app para aromatizar de 3.000 a 4.000 m³: oficinas, showrooms, salones y pasillos.',
      'يجمع ناشر بوكس بين زجاجة سعة 1000 مل والتحكّم عبر التطبيق لتعطير من 3000 إلى 4000 م³ — المكاتب وصالات العرض وغرف المعيشة والممرات.')
  }),
  diffuser({
    id: 'tower-pro-diffuser', sku: 'OZ-TWR-PRO', img: 'o1', type: 'tower', spaces: ['home', 'commercial'], giftable: false,
    price: 890, sizes: [{ id: '1000', ml: 1000, delta: 0 }],
    features: ['tank'],
    specs: [['spec.capacity', '1,000 ml'], ['spec.coverage', '4,000 m³'], ['spec.dims', 'W141 × D141 × H553 mm'], ['spec.voltage', 'DC 12 V – 2 A'], ['spec.weight', '4.29 kg']],
    ideal: T('Lobbies, large living areas and shopping malls', 'Vestíbulos, grandes salones y centros comerciales', 'الردهات ومساحات المعيشة الكبيرة والمراكز التجارية'),
    name: T('Ozone Tower Pro Diffuser', 'Difusor Tower Pro Ozone', 'ناشر أوزون تاور برو'),
    tagline: T('A floor-standing tower for 4,000 m³.', 'Una torre de suelo para 4.000 m³.', 'برج أرضي لمساحة 4000 م³.'),
    desc: T(
      'A slim floor-standing tower with a 1,000 ml bottle that scents up to 4,000 m³ — made for lobbies, large living areas and malls.',
      'Una torre esbelta de suelo con frasco de 1.000 ml que aromatiza hasta 4.000 m³: pensada para vestíbulos, grandes salones y centros comerciales.',
      'برج أرضي نحيف بزجاجة سعة 1000 مل يعطّر حتى 4000 م³ — مصمم للردهات ومساحات المعيشة الكبيرة والمراكز التجارية.')
  }),
  diffuser({
    id: 'tower-diffuser', sku: 'OZ-TWR', img: 'o8', type: 'tower', spaces: ['office', 'commercial'], giftable: false,
    price: 890, sizes: [{ id: '1000', ml: 1000, delta: 0 }],
    features: ['tank'],
    specs: [['spec.capacity', '1,000 ml'], ['spec.coverage', 'Up to 4,000 m³ (900 m²)']],
    ideal: T('Lobbies, gyms, hospitals and restaurants', 'Vestíbulos, gimnasios, hospitales y restaurantes', 'الردهات والصالات الرياضية والمستشفيات والمطاعم'),
    name: T('Ozone Tower', 'Ozone Tower', 'أوزون تاور'),
    tagline: T('Pure fragrance. Anytime. Anywhere.', 'Fragancia pura. En cualquier momento y lugar.', 'عطر نقي. في أي وقت وأي مكان.'),
    desc: T(
      'A black tower with a 1,000 ml bottle that scents up to 4,000 m³ (900 m²) — for lobbies, gyms, hospitals and restaurants.',
      'Una torre negra con frasco de 1.000 ml que aromatiza hasta 4.000 m³ (900 m²): para vestíbulos, gimnasios, hospitales y restaurantes.',
      'برج أسود بزجاجة سعة 1000 مل يعطّر حتى 4000 م³ (900 م²) — للردهات والصالات الرياضية والمستشفيات والمطاعم.')
  })
];

/* ---------- aroma diffuser oils (oil catalogue pages 6–7) ----------
   Price list: AED 230 / 500 ml, AED 320 / 1000 ml.
   Fragrance notes are not given in the catalogue, so `notes` stays empty (admins can add them).
   `family` is a browsing category inferred from each oil's name and artwork, not a composition claim. */
const OIL_DESC = T(
  'Aroma Nature Oil is an environmental aromatic diffuser oil designed to create a fresh, calming, forest-like indoor atmosphere. It uses plant-based aromatic compounds to help promote a cleaner, fresher scent environment and to reduce common airborne odours.',
  'Aroma Nature Oil es un aceite aromático ambiental para difusores, creado para generar una atmósfera interior fresca, relajante y de bosque. Utiliza compuestos aromáticos de origen vegetal que ayudan a crear un ambiente más limpio y fresco y a reducir los olores comunes.',
  'زيت أروما نيتشر هو زيت عطري بيئي للناشرات صُمّم لخلق أجواء داخلية منعشة ومريحة تشبه الغابة. يستخدم مركّبات عطرية نباتية تساعد على بيئة عطرية أنظف وأكثر انتعاشًا وتقليل الروائح الشائعة.');

const oil = (id, en, es, ar, family, opts = {}) => Object.assign({
  id: 'oil-' + id, sku: 'OZ-OIL-' + id.toUpperCase().replace(/-/g, '').slice(0, 10), img: 'oil-' + id, gallery: [], type: 'oil', line: 'signature',
  family, spaces: ['home', 'office', 'commercial'], price: 230, compareAt: 0, stock: 50, rating: 0, reviewCount: 0,
  bestSeller: false, giftable: true, aromaDeal: false, isNew: false,
  sizes: [{ id: '500', ml: 500, delta: 0 }, { id: '1000', ml: 1000, delta: 90 }],
  features: ['plant', 'waterless'],
  specs: [['spec.capacity', '500 ml / 1,000 ml'], ['spec.use', 'Aroma diffuser machines'], ['spec.application', 'External use only — do not ingest']],
  notes: { top: [], heart: [], base: [] },
  name: T(en, es, ar),
  tagline: T('Premium aromatic diffuser oil.', 'Aceite aromático premium para difusor.', 'زيت عطري فاخر للناشرات.'),
  desc: OIL_DESC
}, opts);

const HOTEL = { line: 'hotel', tagline: T('Hotel-inspired fragrance.', 'Fragancia inspirada en hoteles.', 'عطر مستوحى من الفنادق.') };

OZ.SEED_PRODUCTS.push(
  oil('ozone-scent', 'Ozone Scent', 'Ozone Scent', 'أوزون سنت', 'fresh'),
  oil('fitboost', 'FitBoost', 'FitBoost', 'فِت بوست', 'citrus'),
  oil('veloura', 'Veloura', 'Veloura', 'فيلورا', 'floral'),
  oil('address', 'Address', 'Address', 'أدريس', 'woody'),
  oil('deep-sea', 'Deep Sea', 'Deep Sea', 'ديب سي', 'fresh'),
  oil('elegant-her', 'Elegant Her', 'Elegant Her', 'إليغانت هير', 'floral'),
  oil('candy-kiss', 'Candy Kiss', 'Candy Kiss', 'كاندي كيس', 'floral'),
  oil('prestige', 'Prestige', 'Prestige', 'بريستيج', 'woody'),
  oil('root-earth', 'Root Earth', 'Root Earth', 'روت إيرث', 'woody'),
  oil('ginger-mist', 'Ginger Mist', 'Ginger Mist', 'جنجر ميست', 'fresh', { gallery: ['oil-ginger-mist-2'] }),
  oil('blue-water', 'Blue Water', 'Blue Water', 'بلو ووتر', 'fresh'),
  oil('zestora', 'Zestora', 'Zestora', 'زيستورا', 'citrus', { gallery: ['oil-zestora-2'] }),
  oil('velvet-bloom', 'Velvet Bloom', 'Velvet Bloom', 'فيلفت بلوم', 'floral', { gallery: ['oil-velvet-bloom-2'] }),
  oil('love-whisper', 'Love Whisper', 'Love Whisper', 'لوف ويسبر', 'floral', { gallery: ['oil-love-whisper-2'] }),
  oil('lemon-breeze', 'Lemon Breeze', 'Lemon Breeze', 'ليمون بريز', 'citrus'),
  oil('candle-light', 'Candle Light', 'Candle Light', 'كاندل لايت', 'woody', { gallery: ['oil-candle-light-2'] }),
  /* Hotel-inspired line — only the scents that have product artwork are listed */
  oil('address-hotel', 'Address Hotel', 'Address Hotel', 'أدريس هوتيل', 'woody', Object.assign({ gallery: ['oil-address-hotel-2'] }, HOTEL)),
  oil('rove-hotel', 'Rove Hotel', 'Rove Hotel', 'روف هوتيل', 'citrus', Object.assign({ gallery: ['oil-rove-hotel-2'] }, HOTEL)),
  oil('ritz-carlton-hotel', 'Ritz Carlton Hotel', 'Ritz Carlton Hotel', 'ريتز كارلتون هوتيل', 'floral', Object.assign({ gallery: ['oil-ritz-carlton-hotel-2'] }, HOTEL)),
  oil('versace-hotel', 'Versace Hotel', 'Versace Hotel', 'فيرساتشي هوتيل', 'woody', Object.assign({ gallery: ['oil-versace-hotel-2'] }, HOTEL))
);

OZ.SEED_COUPONS = [
  { code: 'WELCOME10', type: 'percent', value: 10, min: 0, active: true, note: '10% off your first order' },
  { code: 'FREESHIP', type: 'ship', value: 0, min: 0, active: true, note: 'Free standard shipping' }
];

/* No seed reviews: ratings only come from real customers (submitted reviews are moderated). */
OZ.SEED_REVIEWS = [];

OZ.SEED_SETTINGS = {
  freeShippingThreshold: 99,
  shippingFee: 15,
  expressFee: 35,
  vatRate: 5,
  giftWrap: { standard: 0, premium: 25, luxury: 45 },
  cryptoEnabled: true,
  announcement: true
};

/* Demo crypto rates (AED per coin) used only to show an indicative amount */
OZ.CRYPTO = {
  USDT: { network: 'TRC-20', aedPerCoin: 3.6725, address: 'TQ7n3oZoneDemoAddr9x4K2mPqL8vWrE5bH1' },
  BTC:  { network: 'Bitcoin', aedPerCoin: 236000, address: 'bc1qozonedemo7x3k9m2p8v4w5r6t0y1u2i3o4' },
  ETH:  { network: 'ERC-20', aedPerCoin: 9800, address: '0x0Z0NEdE7a1b2C3d4E5f6A7b8C9d0E1f2A3b4C5' }
};
