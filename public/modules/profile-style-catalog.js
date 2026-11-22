// First-party visual data only. Persist IDs, never user-supplied style values.
const options = (rows, fields) => Object.freeze(rows.map(([id,label,...values]) =>
  Object.freeze({id,label,...Object.fromEntries(fields.map((field,index) => [field,values[index]]))})));
const conic = (...colors) => `conic-gradient(from 30deg,${colors.join(',')},${colors[0]})`;
const striped = (angle,color) => `repeating-linear-gradient(${angle}deg,transparent 0 12px,${color} 12px 14px)`;
const grid = color => `repeating-linear-gradient(0deg,transparent 0 23px,${color} 23px 24px),repeating-linear-gradient(90deg,transparent 0 23px,${color} 23px 24px)`;
const dots = color => `radial-gradient(circle,${color} 1px,transparent 1.7px) 0 0 / 13px 13px`;

export const profileStyleOptions = Object.freeze({
  ring: options([
    ['copper-trace','Copper Trace',conic('#a34e24','#ffd09a','#ca7240','#70422d')],
    ['signal-blue','Signal Blue',conic('#2154bd','#9aefff','#3979ef','#163668')],
    ['fiber-violet','Fiber Violet',conic('#4a2ab3','#dda4ff','#844df1','#322052')],
    ['emerald','Emerald',conic('#066756','#9bfcd1','#25b88e','#04332f')],
    ['silver-coax','Silver Coax',conic('#505a67','#f8fafc','#a8b3c1','#34404a')],
    ['matte-carbon','Matte Carbon',conic('#313843','#98a0a9','#252a31','#4a535d')],
    ['gold-contact','Gold Contact',conic('#965c10','#fff3ad','#e6a422','#6a410f')],
    ['ruby-signal','Ruby Signal',conic('#7a1b35','#ffabbb','#db3e60','#521b31')],
    ['blue-flame','Blue Flame',conic('#441f8f','#52b8ff','#86fff7','#2056bf')],
    ['sunset','Sunset',conic('#703488','#fa6d6d','#ffe0a1','#ba3461')],
    ['arctic','Arctic',conic('#4294cb','#f4feff','#93cffe','#5291a9')],
    ['high-vis','High Vis',conic('#4b5f13','#d5ff65','#8db940','#27391b')],
    ['rose-gold','Rose Gold',conic('#844b63','#ffd7c9','#be7990','#693349')],
    ['midnight','Midnight',conic('#182043','#6d84da','#29477f','#11182c')],
    ['magma','Magma',conic('#601c2b','#ffa637','#f05228','#7e280c')],
    ['sea-glass','Sea Glass',conic('#216862','#b7fff4','#67c5bb','#25796a')],
    ['lavender-steel','Lavender Steel',conic('#595182','#ede4ff','#9c8cc8','#40495d')],
    ['platinum','Platinum',conic('#6d6160','#fff9e0','#d1c6a0','#827676')],
    ['spectrum','Spectrum',conic('#f97869','#ffdf79','#7fe3ac','#8ac7ff','#c095ef')],
    ['monochrome','Monochrome',conic('#02070b','#eef2f5','#454f59','#eff9ff')]
  ],['background']),
  lighting: options([
    ['amber','Amber','rgba(248,170,73,.34)'],
    ['cobalt','Cobalt','rgba(61,113,255,.37)'],
    ['mint','Mint','rgba(82,222,171,.30)'],
    ['violet','Violet','rgba(159,95,255,.34)'],
    ['ember','Ember','rgba(244,81,52,.32)'],
    ['arctic','Arctic','rgba(135,210,255,.33)'],
    ['rose','Rose','rgba(249,113,156,.32)'],
    ['chartreuse','Chartreuse','rgba(179,228,68,.28)'],
    ['pearl','Pearl','rgba(224,231,255,.25)'],
    ['teal','Teal','rgba(30,203,182,.32)'],
    ['lavender','Lavender','rgba(181,159,255,.34)'],
    ['gold','Gold','rgba(255,213,80,.30)'],
    ['orchid','Orchid','rgba(215,95,201,.31)'],
    ['sea-blue','Sea Blue','rgba(28,159,226,.34)'],
    ['coral','Coral','rgba(255,130,105,.32)'],
    ['copper','Copper','rgba(210,118,69,.34)'],
    ['sage','Sage','rgba(142,192,137,.29)'],
    ['twilight','Twilight','rgba(89,75,185,.40)'],
    ['steel','Steel','rgba(117,143,166,.31)'],
    ['none','No Lighting','rgba(0,0,0,0)']
  ].map(([id,label,glow],index) => [id,label,glow,id==='none'?'none':
    `radial-gradient(ellipse at ${[22,48,72][index%3]}% 0%,${glow},transparent 72%)`]),['glow','gradient']),
  banner: options([
    ['blueprint','Blueprint',`${grid('#77adf342')},linear-gradient(112deg,#102847,#0c1425)`],
    ['copper-run','Copper Run',`${striped(135,'#efb17733')},linear-gradient(110deg,#442915,#221822)`],
    ['rack-vents','Rack Vents','repeating-linear-gradient(0deg,#b1cae500 0 8px,#b1cae544 8px 10px,#b1cae500 10px 14px),linear-gradient(90deg,#263b4d,#10171f)'],
    ['fiber-burst','Fiber Burst','repeating-conic-gradient(from 30deg at 9% 130%,#d7b2ff00 0 9deg,#d7b2ff66 9.5deg 10deg),linear-gradient(90deg,#392965,#11142f)'],
    ['night-shift','Night Shift',`${dots('#bde4ff58')},radial-gradient(ellipse at 32% 115%,#29466c,#101426 72%)`],
    ['patch-panel','Patch Panel','radial-gradient(ellipse,#95bcc851 2px,transparent 2.7px) 0 0 / 18px 10px,linear-gradient(110deg,#294443,#101919)'],
    ['test-pattern','Test Pattern','linear-gradient(90deg,#243d61 0 16%,#1e5267 16% 33%,#315b5f 33% 50%,#614269 50% 66%,#5a415f 66% 83%,#2d3159 83%)'],
    ['heat-map','Heat Map','radial-gradient(ellipse at 20% 70%,#a54a24 0,transparent 47%),radial-gradient(ellipse at 67% 30%,#66273c 0,#27162e 63%)'],
    ['aurora','Aurora','radial-gradient(ellipse at 56% -5%,#367580 0,transparent 51%),radial-gradient(ellipse at 24% 56%,#304d84 0,#151a3c 68%)'],
    ['laser-line','Laser Line','linear-gradient(117deg,transparent 0 44%,#dc7bfd8c 46%,#f7dcff 47%,#ce70f455 48%,transparent 53%),linear-gradient(130deg,#2b1c48,#121724)'],
    ['honeycomb','Honeycomb','repeating-conic-gradient(from 30deg,#c9943c22 0deg 60deg,#c9943c44 60deg 120deg) 0 0 / 34px 29px,linear-gradient(110deg,#352d23,#191a20)'],
    ['steel-weave','Steel Weave',`${striped(45,'#c2d1e42d')},${striped(135,'#c2d1e42d')},linear-gradient(110deg,#324253,#17202b)`],
    ['mountain-signal','Mountain Signal','conic-gradient(from 220deg at 33% 13%,#6a90ab35 0deg 42deg,#0000 42deg),conic-gradient(from 220deg at 74% 3%,#91b5c135 0deg 42deg,#0000 42deg),linear-gradient(180deg,#284556,#0d222f)'],
    ['hazard-edge','Hazard Edge','repeating-linear-gradient(126deg,#d09d4066 0 11px,transparent 11px 22px) top / 100% 9px no-repeat,linear-gradient(110deg,#3c372b,#191c20)'],
    ['wavefront','Wavefront','repeating-radial-gradient(ellipse at 12% 150%,transparent 0 21px,#86e2f444 22px 23px),linear-gradient(112deg,#12495d,#16263f)'],
    ['service-ticket','Service Ticket','radial-gradient(circle at 50% 50%,#9a819433 0 3px,transparent 3.4px) 0 0 / 93px 19px,linear-gradient(110deg,#4e3543,#231b31)'],
    ['cabinet-grade','Cabinet Grade','repeating-linear-gradient(90deg,#afcde315 0 3px,#0000 3px 6px,#afcde330 6px 7px,#0000 7px 13px),linear-gradient(170deg,#344755,#1b252e)'],
    ['forest-conduit','Forest Conduit',`${striped(160,'#9cbb7b29')},linear-gradient(108deg,#344d36,#112823)`],
    ['signal-rings','Signal Rings','repeating-radial-gradient(circle at 84% 53%,transparent 0 17px,#88b4f04d 18px 20px),linear-gradient(95deg,#1b2949,#243e62)'],
    ['plain-slate','Plain Slate','linear-gradient(105deg,#303946,#1a232f)']
  ],['background']),
  section: options([
    ['graphite','Graphite','#191d24','#3c485a'],['navy','Navy','#141e32','#47619a'],
    ['slate','Slate','#202832','#4b647a'],['pine','Pine','#152820','#4a7561'],
    ['ink','Ink','#111721','#384963'],['aubergine','Aubergine','#291d31','#735683'],
    ['oxide','Oxide','#32241c','#855d45'],['wine','Wine','#311d29','#805269'],
    ['midnight-teal','Midnight Teal','#142a30','#3d6c74'],['basalt','Basalt','#27272c','#62606f'],
    ['deep-cobalt','Deep Cobalt','#18264a','#5876b2'],['plum','Plum','#2c2340','#765b9b'],
    ['espresso','Espresso','#2f251d','#78634b'],['spruce','Spruce','#20332b','#5d7968'],
    ['storm','Storm','#263345','#637790'],['black-cherry','Black Cherry','#351c23','#885165'],
    ['petrol','Petrol','#172f3b','#4d798d'],['olive','Olive','#2c3021','#737653'],
    ['charcoal','Charcoal','#171717','#53515b'],['warm-stone','Warm Stone','#312b28','#7f716a']
  ],['background','border']),
  text: options([
    ['soft-white','Soft White','#f4f5f7','#c7ccd5'],['ice','Ice','#e2f5ff','#a9d9f0'],
    ['seafoam','Seafoam','#d6fff1','#a1dccc'],['champagne','Champagne','#fff1d0','#e0cda3'],
    ['rosewater','Rosewater','#ffe2ea','#e7b8cb'],['lavender','Lavender','#eee4ff','#cdb8ec'],
    ['citrus','Citrus','#f4ffc9','#cbdc97'],['silver','Silver','#edf1f7','#b7c6d8'],
    ['sky','Sky','#dbeaff','#afc9ee'],['peach','Peach','#ffe8d5','#e8bea4'],
    ['aqua','Aqua','#d5fbfd','#a4d9de'],['ivory','Ivory','#fffbe8','#ddd2b9'],
    ['fern','Fern','#e7f4d7','#bdd6a7'],['sakura','Sakura','#ffe7f7','#e1bce0'],
    ['periwinkle','Periwinkle','#e2e7ff','#b7c0ef'],['sand','Sand','#f4eadc','#d6c4ae'],
    ['buttercream','Buttercream','#fff8bf','#e2d387'],['powder-blue','Powder Blue','#e7f2f9','#aecedc'],
    ['spring','Spring','#e1ffe0','#a9d7aa'],['silver-lilac','Silver Lilac','#eceafa','#c7bedc']
  ],['color','muted']),
  icon: options([
    ['rj45','RJ45 Plug','M7 3h10v3h3v11h-4v4H8v-4H4V6h3zM8 7v4m3-4v4m2-4v4m3-4v4M8 17h8'],
    ['fiber','Fiber Optic','M3 18h5l6-6m-2-3 5 5m-5-5 4-4 5 5-4 4M17 6l2-2m1 5 2-2M4 22h7l5-5'],
    ['tester','Cable Tester','M6 4h12v17H6zM9 4V2m6 2V2M9 7h6v5H9zM9 16h2m2 0h2m-6 2h2m2 0h2'],
    ['camera','Security Camera','M3 8h14l4 3-5 4H3zM4 15l4 3h7m-6-3v3m2 0v3m-4 0h8M18 9V7m-2 8 2 1'],
    ['wifi','Wi-Fi','M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 3v1'],
    ['rack','Server Rack','M5 3h14v18H5zM5 9h14M5 15h14M8 6h1m3 0h4m-8 6h1m3 0h4m-8 6h1m3 0h4'],
    ['switch','Network Switch','M3 7h18v11H3zM6 11h2v3H6zm5 0h2v3h-2zm5 0h2v3h-2zM6 5h12M7 18v2m10-2v2'],
    ['badge','Access Badge','M9 5V3h6v2m-9 13V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zm3-1a3 3 0 0 1 6 0m-3-5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
    ['lock','Electric Lock','M5 10h14v11H5zm3 0V7a4 4 0 0 1 8 0v3m-4 4v3'],
    ['door','Door Contact','M4 21V3h14v18M7 21V6l8-1v16m-4-8h1m6 8h3M3 21h1'],
    ['crimper','Crimp Tool','M10 11l-5 7a2 2 0 0 0 3 2l4-6m1-2 4 8a2 2 0 0 0 3-2l-5-7M8 4h8l2 3-4 4h-4L6 7zM9 7h6'],
    ['wrench','Service Wrench','M14 3a5 5 0 0 0-5 6L3.5 15a3 3 0 1 0 4 4L13 13a5 5 0 0 0 7-6l-4 3-3-3 3-4zM5 17h.01'],
    ['drill','Cordless Drill','M3 6h12l3 3v4h-7l-2 7H5l2-7H3zM18 10h4m-10 3-1 3M6 9h6M4 20h7'],
    ['hard-hat','Hard Hat','M3 16h18v3H3zM5 16v-3a7 7 0 0 1 14 0v3M10 10V5h4v5m-8 3h12'],
    ['ladder','Ladder','M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10M5 21h4m6 0h4'],
    ['headset','Service Headset','M4 13V10a8 8 0 0 1 16 0v7c0 2-2 3-4 3h-3M4 12h4v6H5a1 1 0 0 1-1-1zm12 0h4v5a1 1 0 0 1-1 1h-3zm-3 7v2'],
    ['speaker','Ceiling Speaker','M3 9h4l5-4v14l-5-4H3zm12 1a3 3 0 0 1 0 4m2-7a7 7 0 0 1 0 10m2-13a11 11 0 0 1 0 16'],
    ['conduit','Conduit Bend','M3 13h9V4m-9 15h10a5 5 0 0 0 5-5V4M2 13h2m-2 6h2M11 4h8M7 13v6'],
    ['clipboard','Job Checklist','M7 5H4v16h16V5h-3M8 3h8v4H8zm-1 9 1 1 2-2m2 1h5m-10 4 1 1 2-2m2 1h5'],
    ['labeler','Label Printer','M6 5h12v5M4 10h16l2 3v5h-5m-10 0H2v-5zm3 11v-6h10v6H7zm3-3h4m3-5h2M9 7h6']
  ],['path'])
});

export const defaultProfileStyle = Object.freeze({
  ring:'copper-trace',lighting:'amber',banner:'blueprint',section:'graphite',text:'soft-white',icon:'rj45'
});
const byId = new Map(Object.entries(profileStyleOptions).map(([key,list]) => [
  key,new Map(list.map(item => [item.id,item]))
]));
export function findProfileStyleOption(category,id) {
  const index = byId.get(category);
  if (!index) return null;
  return index.get(id) ?? index.get(defaultProfileStyle[category]);
}
export function normalizeProfileStyle(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.keys(defaultProfileStyle).map(key =>
    [key,findProfileStyleOption(key,Object.hasOwn(src,key) ? src[key] : undefined).id]));
}
