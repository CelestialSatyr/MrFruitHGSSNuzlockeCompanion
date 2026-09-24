import { HgssLocationSchema, type HgssAvailability, type HgssLocation } from "../locations.ts";

const TRUE = true as const;

function allOf(
  ...conditions: Array<
    | {
        kind: "badge";
        key: "zephyr" | "hive" | "plain" | "fog" | "storm" | "mineral" | "glacier" | "rising";
        value?: boolean;
      }
    | {
        kind: "capability";
        key:
          | "cut"
          | "fly"
          | "surf"
          | "strength"
          | "flash"
          | "whirlpool"
          | "waterfall"
          | "rockSmash"
          | "oldRod"
          | "goodRod"
          | "headbutt";
        value?: boolean;
      }
    | {
        kind: "milestone";
        key:
          | "starterReceived"
          | "mysteryEggDeliveredToElm"
          | "mysteryEggReceived"
          | "slowpokeWellCleared"
          | "ilexForestFarfetchdResolved"
          | "sudowoodoCleared"
          | "burnedTowerVisited"
          | "secretMedicineObtained"
          | "lighthouseMedicineDelivered"
          | "redGyaradosResolved"
          | "rocketHQCleared"
          | "radioTowerCleared"
          | "blackthornGymDefeated"
          | "dragonsDenCleared"
          | "kimonoGirlsDefeated"
          | "towerLegendaryResolved"
          | "pokemonLeagueGateCleared"
          | "eliteFourDefeated";
        value?: boolean;
      }
  >
): HgssAvailability {
  return {
    anyOf: [
      {
        allOf: conditions.map((condition) => ({ ...condition, value: condition.value ?? TRUE })),
      },
    ],
  };
}

function anyOf(
  ...conditions: Array<
    | {
        kind: "badge";
        key: "zephyr" | "hive" | "plain" | "fog" | "storm" | "mineral" | "glacier" | "rising";
        value?: boolean;
      }
    | {
        kind: "capability";
        key:
          | "cut"
          | "fly"
          | "surf"
          | "strength"
          | "flash"
          | "whirlpool"
          | "waterfall"
          | "rockSmash"
          | "oldRod"
          | "goodRod"
          | "headbutt";
        value?: boolean;
      }
    | {
        kind: "milestone";
        key:
          | "starterReceived"
          | "mysteryEggDeliveredToElm"
          | "mysteryEggReceived"
          | "slowpokeWellCleared"
          | "ilexForestFarfetchdResolved"
          | "sudowoodoCleared"
          | "burnedTowerVisited"
          | "secretMedicineObtained"
          | "lighthouseMedicineDelivered"
          | "redGyaradosResolved"
          | "rocketHQCleared"
          | "radioTowerCleared"
          | "blackthornGymDefeated"
          | "dragonsDenCleared"
          | "kimonoGirlsDefeated"
          | "towerLegendaryResolved"
          | "pokemonLeagueGateCleared"
          | "eliteFourDefeated";
        value?: boolean;
      }
  >
): HgssAvailability {
  return {
    anyOf: conditions.map((condition) => ({
      allOf: [{ ...condition, value: condition.value ?? TRUE }],
    })),
  };
}

const waterEncounterAccess = anyOf(
  { kind: "capability", key: "oldRod" },
  { kind: "capability", key: "goodRod" },
  { kind: "capability", key: "surf" },
);

const sevenBadges = [
  { kind: "badge" as const, key: "zephyr" as const },
  { kind: "badge" as const, key: "hive" as const },
  { kind: "badge" as const, key: "plain" as const },
  { kind: "badge" as const, key: "fog" as const },
  { kind: "badge" as const, key: "storm" as const },
  { kind: "badge" as const, key: "mineral" as const },
  { kind: "badge" as const, key: "glacier" as const },
];

const eightBadges = [...sevenBadges, { kind: "badge" as const, key: "rising" as const }];

const rawLocations: HgssLocation[] = [
  {
    id: "new-bark-town",
    name: "New Bark Town",
    region: "johto",
    kind: "town",
    mainGame: true,
    order: 10,
    map: { anchor: { x: 0.66548, y: 0.67629 }, shapeId: "new-bark-town" },
    opportunities: [
      { id: "starter-pair", label: "Starter pair", kind: "starter", defaultEnabled: true },
      {
        id: "new-bark-main",
        label: "Wild encounter",
        kind: "wild",
        defaultEnabled: false,
        availability: anyOf(
          { kind: "capability", key: "oldRod" },
          { kind: "capability", key: "goodRod" },
          { kind: "capability", key: "surf" },
          { kind: "capability", key: "headbutt" },
        ),
      },
    ],
  },
  {
    id: "route-29",
    name: "Route 29",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 20,
    map: { anchor: { x: 0.60428, y: 0.66489 }, shapeId: "route-29" },
    opportunities: [
      { id: "route-29-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-46",
    name: "Route 46",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 25,
    map: { anchor: { x: 0.63233, y: 0.6003 }, shapeId: "route-46" },
    opportunities: [
      { id: "route-46-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "cherrygrove-city",
    name: "Cherrygrove City",
    region: "johto",
    kind: "city",
    mainGame: true,
    order: 30,
    map: { anchor: { x: 0.53289, y: 0.66489 }, shapeId: "cherrygrove-city" },
    opportunities: [
      {
        id: "cherrygrove-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: anyOf(
          { kind: "capability", key: "oldRod" },
          { kind: "capability", key: "goodRod" },
          { kind: "capability", key: "surf" },
          { kind: "capability", key: "headbutt" },
        ),
      },
    ],
  },
  {
    id: "route-30",
    name: "Route 30",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 40,
    map: { anchor: { x: 0.53289, y: 0.5965 }, shapeId: "route-30" },
    opportunities: [
      { id: "route-30-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-31",
    name: "Route 31",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 50,
    map: { anchor: { x: 0.51249, y: 0.53191 }, shapeId: "route-31" },
    opportunities: [
      { id: "route-31-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "dark-cave",
    name: "Dark Cave",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 55,
    map: { anchor: { x: 0.57369, y: 0.49392 }, shapeId: "dark-cave" },
    opportunities: [
      { id: "dark-cave-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "violet-city",
    name: "Violet City",
    region: "johto",
    kind: "city",
    mainGame: true,
    order: 60,
    map: { anchor: { x: 0.49465, y: 0.47112 }, shapeId: "violet-city" },
    opportunities: [
      {
        id: "violet-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: anyOf(
          { kind: "capability", key: "oldRod" },
          { kind: "capability", key: "goodRod" },
          { kind: "capability", key: "surf" },
          { kind: "capability", key: "headbutt" },
        ),
      },
      {
        id: "violet-togepi-egg",
        label: "Togepi Egg gift",
        kind: "gift",
        defaultEnabled: false,
        availability: allOf({ kind: "badge", key: "zephyr" }),
      },
    ],
  },
  {
    id: "sprout-tower",
    name: "Sprout Tower",
    region: "johto",
    kind: "building",
    mainGame: true,
    order: 65,
    map: { anchor: { x: 0.4972, y: 0.42933 }, shapeId: "sprout-tower" },
    opportunities: [
      { id: "sprout-tower-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "ruins-of-alph",
    name: "Ruins of Alph",
    region: "johto",
    kind: "landmark",
    mainGame: true,
    order: 70,
    availability: allOf({ kind: "badge", key: "zephyr" }),
    map: { anchor: { x: 0.45385, y: 0.54331 }, shapeId: "ruins-of-alph" },
    opportunities: [
      { id: "ruins-of-alph-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-32",
    name: "Route 32",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 80,
    availability: allOf({ kind: "badge", key: "zephyr" }),
    map: { anchor: { x: 0.487, y: 0.6117 }, shapeId: "route-32" },
    opportunities: [
      { id: "route-32-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "union-cave",
    name: "Union Cave",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 90,
    availability: allOf({ kind: "badge", key: "zephyr" }),
    map: { anchor: { x: 0.47425, y: 0.69909 }, shapeId: "union-cave" },
    opportunities: [
      { id: "union-cave-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
      {
        id: "union-cave-lapras",
        label: "Friday Lapras",
        kind: "static",
        defaultEnabled: false,
        availability: allOf({ kind: "badge", key: "fog" }, { kind: "capability", key: "surf" }),
      },
    ],
  },
  {
    id: "route-33",
    name: "Route 33",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 100,
    availability: allOf({ kind: "badge", key: "zephyr" }),
    map: { anchor: { x: 0.4462, y: 0.73708 }, shapeId: "route-33" },
    opportunities: [
      { id: "route-33-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "azalea-town",
    name: "Azalea Town",
    region: "johto",
    kind: "town",
    mainGame: true,
    order: 110,
    availability: allOf({ kind: "badge", key: "zephyr" }),
    map: { anchor: { x: 0.4258, y: 0.78647 }, shapeId: "azalea-town" },
    opportunities: [
      {
        id: "azalea-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: allOf({ kind: "capability", key: "headbutt" }),
      },
    ],
  },
  {
    id: "slowpoke-well",
    name: "Slowpoke Well",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 115,
    availability: allOf({ kind: "badge", key: "zephyr" }),
    map: { anchor: { x: 0.4411, y: 0.76748 }, shapeId: "slowpoke-well" },
    opportunities: [
      { id: "slowpoke-well-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "ilex-forest",
    name: "Ilex Forest",
    region: "johto",
    kind: "forest",
    mainGame: true,
    order: 120,
    availability: allOf({ kind: "badge", key: "hive" }),
    map: { anchor: { x: 0.39266, y: 0.70669 }, shapeId: "ilex-forest" },
    opportunities: [
      { id: "ilex-forest-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-34",
    name: "Route 34",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 130,
    availability: allOf(
      { kind: "badge", key: "hive" },
      { kind: "capability", key: "cut" },
      { kind: "milestone", key: "ilexForestFarfetchdResolved" },
    ),
    map: { anchor: { x: 0.37481, y: 0.66869 }, shapeId: "route-34" },
    opportunities: [
      { id: "route-34-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "goldenrod-city",
    name: "Goldenrod City",
    region: "johto",
    kind: "city",
    mainGame: true,
    order: 140,
    availability: allOf(
      { kind: "badge", key: "hive" },
      { kind: "capability", key: "cut" },
      { kind: "milestone", key: "ilexForestFarfetchdResolved" },
    ),
    map: { anchor: { x: 0.36971, y: 0.6155 }, shapeId: "goldenrod-city" },
    opportunities: [
      {
        id: "goldenrod-eevee-gift",
        label: "Bill's Eevee gift",
        kind: "gift",
        defaultEnabled: false,
        availability: allOf({ kind: "milestone", key: "burnedTowerVisited" }),
      },
    ],
  },
  {
    id: "route-35",
    name: "Route 35",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 150,
    availability: allOf(
      { kind: "badge", key: "hive" },
      { kind: "capability", key: "cut" },
      { kind: "milestone", key: "ilexForestFarfetchdResolved" },
    ),
    map: { anchor: { x: 0.36716, y: 0.52432 }, shapeId: "route-35" },
    opportunities: [
      { id: "route-35-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "national-park",
    name: "National Park",
    region: "johto",
    kind: "landmark",
    mainGame: true,
    order: 155,
    availability: allOf(
      { kind: "badge", key: "hive" },
      { kind: "capability", key: "cut" },
      { kind: "milestone", key: "ilexForestFarfetchdResolved" },
    ),
    map: { anchor: { x: 0.36716, y: 0.43693 }, shapeId: "national-park" },
    opportunities: [
      { id: "national-park-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-36",
    name: "Route 36",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 160,
    availability: allOf(
      { kind: "badge", key: "hive" },
      { kind: "capability", key: "cut" },
      { kind: "milestone", key: "ilexForestFarfetchdResolved" },
    ),
    map: { anchor: { x: 0.4207, y: 0.45213 }, shapeId: "route-36" },
    opportunities: [
      { id: "route-36-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
      {
        id: "route-36-sudowoodo",
        label: "Sudowoodo static encounter",
        kind: "static",
        defaultEnabled: false,
        availability: allOf({ kind: "badge", key: "plain" }),
      },
    ],
  },
  {
    id: "route-37",
    name: "Route 37",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 170,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.39266, y: 0.39894 }, shapeId: "route-37" },
    opportunities: [
      { id: "route-37-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "ecruteak-city",
    name: "Ecruteak City",
    region: "johto",
    kind: "city",
    mainGame: true,
    order: 180,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.38246, y: 0.33815 }, shapeId: "ecruteak-city" },
    opportunities: [
      {
        id: "ecruteak-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: anyOf(
          { kind: "capability", key: "oldRod" },
          { kind: "capability", key: "goodRod" },
          { kind: "capability", key: "surf" },
          { kind: "capability", key: "headbutt" },
        ),
      },
    ],
  },
  {
    id: "burned-tower",
    name: "Burned Tower",
    region: "johto",
    kind: "building",
    mainGame: true,
    order: 185,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.36206, y: 0.33435 }, shapeId: "burned-tower" },
    opportunities: [
      { id: "burned-tower-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-38",
    name: "Route 38",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 190,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.33146, y: 0.33815 }, shapeId: "route-38" },
    opportunities: [
      { id: "route-38-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-39",
    name: "Route 39",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 200,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.30087, y: 0.38374 }, shapeId: "route-39" },
    opportunities: [
      { id: "route-39-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "olivine-city",
    name: "Olivine City",
    region: "johto",
    kind: "city",
    mainGame: true,
    order: 210,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.26007, y: 0.44833 }, shapeId: "olivine-city" },
    opportunities: [
      {
        id: "olivine-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: waterEncounterAccess,
      },
    ],
  },
  {
    id: "route-40",
    name: "Route 40",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 220,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.23967, y: 0.51672 }, shapeId: "route-40" },
    opportunities: [
      { id: "route-40-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-41",
    name: "Route 41",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 230,
    availability: allOf({ kind: "badge", key: "fog" }, { kind: "capability", key: "surf" }),
    map: { anchor: { x: 0.21928, y: 0.56991 }, shapeId: "route-41" },
    opportunities: [
      { id: "route-41-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "whirl-islands",
    name: "Whirl Islands",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 235,
    availability: allOf(
      { kind: "badge", key: "fog" },
      { kind: "capability", key: "surf" },
      { kind: "badge", key: "glacier" },
      { kind: "capability", key: "whirlpool" },
    ),
    map: { anchor: { x: 0.25752, y: 0.6003 }, shapeId: "whirl-islands" },
    opportunities: [
      { id: "whirl-islands-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
      {
        id: "whirl-islands-lugia",
        label: "Lugia",
        kind: "static",
        defaultEnabled: false,
        versions: ["soulsilver"],
        availability: allOf(
          { kind: "milestone", key: "kimonoGirlsDefeated" },
          { kind: "capability", key: "whirlpool" },
        ),
      },
    ],
  },
  {
    id: "cianwood-city",
    name: "Cianwood City",
    region: "johto",
    kind: "city",
    mainGame: true,
    order: 240,
    availability: allOf({ kind: "badge", key: "fog" }, { kind: "capability", key: "surf" }),
    map: { anchor: { x: 0.19123, y: 0.6193 }, shapeId: "cianwood-city" },
    opportunities: [
      {
        id: "cianwood-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: waterEncounterAccess,
      },
      {
        id: "cianwood-shuckle-gift",
        label: "Shuckle gift",
        kind: "gift",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "cliff-edge-gate",
    name: "Cliff Edge Gate",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 245,
    availability: allOf(
      { kind: "milestone", key: "lighthouseMedicineDelivered" },
      { kind: "badge", key: "fog" },
      { kind: "capability", key: "surf" },
    ),
    map: { anchor: { x: 0.16573, y: 0.58891 }, shapeId: "cliff-edge-gate" },
    opportunities: [],
  },
  {
    id: "route-47",
    name: "Route 47",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 250,
    availability: allOf(
      { kind: "milestone", key: "lighthouseMedicineDelivered" },
      { kind: "badge", key: "fog" },
      { kind: "capability", key: "surf" },
    ),
    map: { anchor: { x: 0.13768, y: 0.57751 }, shapeId: "route-47" },
    opportunities: [
      { id: "route-47-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "cliff-cave",
    name: "Cliff Cave",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 255,
    availability: allOf(
      { kind: "milestone", key: "lighthouseMedicineDelivered" },
      { kind: "badge", key: "fog" },
      { kind: "capability", key: "surf" },
    ),
    map: { anchor: { x: 0.11984, y: 0.55471 }, shapeId: "cliff-cave" },
    opportunities: [
      { id: "cliff-cave-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-48",
    name: "Route 48",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 260,
    availability: allOf(
      { kind: "milestone", key: "lighthouseMedicineDelivered" },
      { kind: "badge", key: "fog" },
      { kind: "capability", key: "surf" },
    ),
    map: { anchor: { x: 0.09689, y: 0.53191 }, shapeId: "route-48" },
    opportunities: [
      { id: "route-48-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "safari-zone-gate",
    name: "Safari Zone Gate",
    region: "johto",
    kind: "landmark",
    mainGame: true,
    order: 263,
    availability: allOf(
      { kind: "milestone", key: "lighthouseMedicineDelivered" },
      { kind: "badge", key: "fog" },
      { kind: "capability", key: "surf" },
    ),
    map: { anchor: { x: 0.08669, y: 0.49392 }, shapeId: "safari-zone-gate" },
    opportunities: [
      {
        id: "safari-zone-gate-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: allOf({ kind: "capability", key: "headbutt" }),
      },
    ],
  },
  {
    id: "safari-zone",
    name: "Safari Zone",
    region: "johto",
    kind: "landmark",
    mainGame: true,
    order: 265,
    availability: allOf(
      { kind: "milestone", key: "lighthouseMedicineDelivered" },
      { kind: "badge", key: "fog" },
      { kind: "capability", key: "surf" },
    ),
    map: { anchor: { x: 0.07394, y: 0.46353 }, shapeId: "safari-zone" },
    opportunities: [
      {
        id: "safari-zone-main",
        label: "Safari Zone encounter",
        kind: "wild",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "route-42",
    name: "Route 42",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 270,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.45895, y: 0.34574 }, shapeId: "route-42" },
    opportunities: [
      { id: "route-42-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "mt-mortar",
    name: "Mt. Mortar",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 275,
    availability: allOf({ kind: "milestone", key: "sudowoodoCleared" }),
    map: { anchor: { x: 0.487, y: 0.32295 }, shapeId: "mt-mortar" },
    opportunities: [
      { id: "mt-mortar-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
      {
        id: "mt-mortar-tyrogue-gift",
        label: "Tyrogue gift",
        kind: "gift",
        defaultEnabled: false,
        availability: allOf(
          { kind: "badge", key: "rising" },
          { kind: "capability", key: "waterfall" },
        ),
      },
    ],
  },
  {
    id: "mahogany-town",
    name: "Mahogany Town",
    region: "johto",
    kind: "town",
    mainGame: true,
    order: 280,
    availability: allOf({ kind: "badge", key: "fog" }, { kind: "capability", key: "surf" }),
    map: { anchor: { x: 0.52779, y: 0.35334 }, shapeId: "mahogany-town" },
    opportunities: [],
  },
  {
    id: "route-43",
    name: "Route 43",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 290,
    availability: allOf({ kind: "badge", key: "fog" }, { kind: "capability", key: "surf" }),
    map: { anchor: { x: 0.53034, y: 0.25456 }, shapeId: "route-43" },
    opportunities: [
      { id: "route-43-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "lake-of-rage",
    name: "Lake of Rage",
    region: "johto",
    kind: "landmark",
    mainGame: true,
    order: 300,
    availability: allOf({ kind: "badge", key: "fog" }, { kind: "capability", key: "surf" }),
    map: { anchor: { x: 0.53034, y: 0.15957 }, shapeId: "lake-of-rage" },
    opportunities: [
      { id: "lake-of-rage-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
      {
        id: "lake-of-rage-red-gyarados",
        label: "Red Gyarados",
        kind: "static",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "rocket-hq",
    name: "Team Rocket HQ",
    region: "johto",
    kind: "building",
    mainGame: true,
    order: 310,
    availability: allOf({ kind: "milestone", key: "redGyaradosResolved" }),
    map: { anchor: { x: 0.53289, y: 0.36474 }, shapeId: "rocket-hq" },
    opportunities: [
      {
        id: "rocket-hq-electrode",
        label: "Electrode static encounter",
        kind: "static",
        defaultEnabled: false,
      },
    ],
  },
  {
    id: "goldenrod-radio-tower",
    name: "Goldenrod Radio Tower",
    region: "johto",
    kind: "building",
    mainGame: true,
    order: 320,
    availability: allOf({ kind: "badge", key: "glacier" }),
    map: { anchor: { x: 0.34676, y: 0.6003 }, shapeId: "goldenrod-radio-tower" },
    opportunities: [],
  },
  {
    id: "route-44",
    name: "Route 44",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 330,
    availability: allOf(...sevenBadges, { kind: "milestone", key: "radioTowerCleared" }),
    map: { anchor: { x: 0.58134, y: 0.34574 }, shapeId: "route-44" },
    opportunities: [
      { id: "route-44-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "ice-path",
    name: "Ice Path",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 340,
    availability: allOf(...sevenBadges, { kind: "milestone", key: "radioTowerCleared" }),
    map: { anchor: { x: 0.63488, y: 0.33435 }, shapeId: "ice-path" },
    opportunities: [
      { id: "ice-path-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "blackthorn-city",
    name: "Blackthorn City",
    region: "johto",
    kind: "city",
    mainGame: true,
    order: 350,
    availability: allOf(
      ...sevenBadges,
      { kind: "milestone", key: "radioTowerCleared" },
      { kind: "capability", key: "strength" },
    ),
    map: { anchor: { x: 0.67568, y: 0.33815 }, shapeId: "blackthorn-city" },
    opportunities: [
      {
        id: "blackthorn-main",
        label: "Main encounter",
        kind: "wild",
        defaultEnabled: true,
        availability: waterEncounterAccess,
      },
    ],
  },
  {
    id: "dragons-den",
    name: "Dragon's Den",
    region: "johto",
    kind: "cave",
    mainGame: true,
    order: 360,
    availability: allOf({ kind: "milestone", key: "blackthornGymDefeated" }),
    map: { anchor: { x: 0.67823, y: 0.29635 }, shapeId: "dragons-den" },
    opportunities: [
      { id: "dragons-den-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
      {
        id: "dragons-den-dratini-gift",
        label: "Dratini gift",
        kind: "gift",
        defaultEnabled: false,
        availability: allOf({ kind: "milestone", key: "dragonsDenCleared" }),
      },
    ],
  },
  {
    id: "route-45",
    name: "Route 45",
    region: "johto",
    kind: "route",
    mainGame: true,
    order: 370,
    availability: allOf(
      ...sevenBadges,
      { kind: "milestone", key: "radioTowerCleared" },
      { kind: "capability", key: "strength" },
    ),
    map: { anchor: { x: 0.66803, y: 0.47492 }, shapeId: "route-45" },
    opportunities: [
      { id: "route-45-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "bell-tower",
    name: "Bell Tower",
    region: "johto",
    kind: "building",
    mainGame: true,
    order: 380,
    availability: allOf({ kind: "milestone", key: "kimonoGirlsDefeated" }),
    map: { anchor: { x: 0.40949, y: 0.26596 }, shapeId: "bell-tower" },
    opportunities: [
      {
        id: "bell-tower-ho-oh",
        label: "Ho-Oh",
        kind: "static",
        defaultEnabled: false,
        versions: ["heartgold"],
      },
    ],
  },
  {
    id: "route-27",
    name: "Route 27",
    region: "kanto",
    kind: "route",
    mainGame: true,
    order: 390,
    availability: allOf(
      ...eightBadges,
      { kind: "milestone", key: "towerLegendaryResolved" },
      { kind: "capability", key: "surf" },
      { kind: "capability", key: "waterfall" },
    ),
    map: { anchor: { x: 0.73942, y: 0.68009 }, shapeId: "route-27" },
    opportunities: [
      { id: "route-27-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "tohjo-falls",
    name: "Tohjo Falls",
    region: "kanto",
    kind: "cave",
    mainGame: true,
    order: 400,
    availability: allOf(
      ...eightBadges,
      { kind: "milestone", key: "towerLegendaryResolved" },
      { kind: "capability", key: "surf" },
      { kind: "capability", key: "waterfall" },
    ),
    map: { anchor: { x: 0.79041, y: 0.66109 }, shapeId: "tohjo-falls" },
    opportunities: [
      { id: "tohjo-falls-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "route-26",
    name: "Route 26",
    region: "kanto",
    kind: "route",
    mainGame: true,
    order: 410,
    availability: allOf(
      ...eightBadges,
      { kind: "milestone", key: "towerLegendaryResolved" },
      { kind: "capability", key: "surf" },
      { kind: "capability", key: "waterfall" },
    ),
    map: { anchor: { x: 0.95869, y: 0.6003 }, shapeId: "route-26" },
    opportunities: [
      { id: "route-26-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "victory-road",
    name: "Victory Road",
    region: "kanto",
    kind: "cave",
    mainGame: true,
    order: 420,
    availability: allOf(...eightBadges, { kind: "milestone", key: "towerLegendaryResolved" }),
    map: { anchor: { x: 0.9332, y: 0.50532 }, shapeId: "victory-road" },
    opportunities: [
      { id: "victory-road-main", label: "Main encounter", kind: "wild", defaultEnabled: true },
    ],
  },
  {
    id: "indigo-plateau",
    name: "Indigo Plateau",
    region: "kanto",
    kind: "landmark",
    mainGame: true,
    order: 430,
    availability: allOf(...eightBadges, { kind: "milestone", key: "towerLegendaryResolved" }),
    map: { anchor: { x: 0.9281, y: 0.44833 }, shapeId: "indigo-plateau" },
    opportunities: [],
  },
];

export const HGSS_MAIN_STORY_LOCATIONS = HgssLocationSchema.array().parse(rawLocations);

export interface HgssMapConnection {
  from: string;
  to: string;
  kind?: "road" | "water" | "cave";
}

export const HGSS_MAIN_STORY_CONNECTIONS: readonly HgssMapConnection[] = [
  { from: "new-bark-town", to: "route-29" },
  { from: "route-29", to: "cherrygrove-city" },
  { from: "route-29", to: "route-46" },
  { from: "cherrygrove-city", to: "route-30" },
  { from: "route-30", to: "route-31" },
  { from: "route-31", to: "violet-city" },
  { from: "route-31", to: "dark-cave", kind: "cave" },
  { from: "violet-city", to: "sprout-tower" },
  { from: "violet-city", to: "route-32" },
  { from: "route-32", to: "ruins-of-alph" },
  { from: "route-32", to: "union-cave" },
  { from: "union-cave", to: "route-33", kind: "cave" },
  { from: "route-33", to: "azalea-town" },
  { from: "azalea-town", to: "slowpoke-well", kind: "cave" },
  { from: "azalea-town", to: "ilex-forest" },
  { from: "ilex-forest", to: "route-34" },
  { from: "route-34", to: "goldenrod-city" },
  { from: "goldenrod-city", to: "route-35" },
  { from: "route-35", to: "national-park" },
  { from: "national-park", to: "route-36" },
  { from: "route-36", to: "violet-city" },
  { from: "route-36", to: "route-37" },
  { from: "route-37", to: "ecruteak-city" },
  { from: "ecruteak-city", to: "burned-tower" },
  { from: "ecruteak-city", to: "route-38" },
  { from: "ecruteak-city", to: "route-42" },
  { from: "ecruteak-city", to: "bell-tower" },
  { from: "route-38", to: "route-39" },
  { from: "route-39", to: "olivine-city" },
  { from: "olivine-city", to: "route-40" },
  { from: "route-40", to: "route-41", kind: "water" },
  { from: "route-41", to: "cianwood-city", kind: "water" },
  { from: "route-41", to: "whirl-islands", kind: "water" },
  { from: "cianwood-city", to: "cliff-edge-gate", kind: "cave" },
  { from: "cliff-edge-gate", to: "route-47", kind: "cave" },
  { from: "route-47", to: "cliff-cave", kind: "cave" },
  { from: "cliff-cave", to: "route-48", kind: "cave" },
  { from: "route-48", to: "safari-zone-gate" },
  { from: "safari-zone-gate", to: "safari-zone" },
  { from: "route-42", to: "mt-mortar", kind: "cave" },
  { from: "route-42", to: "mahogany-town" },
  { from: "mahogany-town", to: "route-43" },
  { from: "mahogany-town", to: "rocket-hq" },
  { from: "route-43", to: "lake-of-rage" },
  { from: "goldenrod-city", to: "goldenrod-radio-tower" },
  { from: "mahogany-town", to: "route-44" },
  { from: "route-44", to: "ice-path" },
  { from: "ice-path", to: "blackthorn-city", kind: "cave" },
  { from: "blackthorn-city", to: "dragons-den", kind: "cave" },
  { from: "blackthorn-city", to: "route-45" },
  { from: "route-45", to: "route-46" },
  { from: "new-bark-town", to: "route-27", kind: "water" },
  { from: "route-27", to: "tohjo-falls", kind: "cave" },
  { from: "tohjo-falls", to: "route-26", kind: "cave" },
  { from: "route-26", to: "victory-road" },
  { from: "victory-road", to: "indigo-plateau", kind: "cave" },
];
