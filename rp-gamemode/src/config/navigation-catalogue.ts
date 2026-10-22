// Original Frostveil catalogue. Keep byte-for-byte data parity with mod-work catalogue.json (verified by tests).
export const navigationCatalogue = [
  {
    "key": "courier-route-1-v1",
    "routeId": "courier-route-1",
    "quest": 2048,
    "reference": 2304,
    "title": "Courier: Watchtower Letter",
    "destination": "Watchtower delivery point",
    "cell": "3c:skyrim.esm",
    "pos": [
      123342.421875,
      -65940.078125,
      11686.185546875
    ]
  },
  {
    "key": "sarethi-farm-v1",
    "routeId": "sarethi-farm",
    "quest": 2049,
    "reference": 2305,
    "title": "Courier: Sarethi Farm",
    "destination": "Sarethi Farm",
    "cell": "3c:skyrim.esm",
    "pos": [
      113230.2109375,
      -70612.046875,
      11489.9326171875
    ]
  },
  {
    "key": "heartwood-mill-v1",
    "routeId": "heartwood-mill",
    "quest": 2050,
    "reference": 2306,
    "title": "Courier: Heartwood Mill",
    "destination": "Heartwood Mill",
    "cell": "3c:skyrim.esm",
    "pos": [
      133492.171875,
      -95859.5546875,
      10712.95703125
    ]
  },
  {
    "key": "merryfair-farm-v1",
    "routeId": "merryfair-farm",
    "quest": 2051,
    "reference": 2307,
    "title": "Courier: Merryfair Farm",
    "destination": "Merryfair Farm",
    "cell": "3c:skyrim.esm",
    "pos": [
      166696.125,
      -88590.9765625,
      11069.578125
    ]
  },
  {
    "key": "shors-stone-v1",
    "routeId": "shors-stone",
    "quest": 2052,
    "reference": 2308,
    "title": "Courier: Shor's Stone",
    "destination": "Shor's Stone",
    "cell": "3c:skyrim.esm",
    "pos": [
      163113.09375,
      -62752.30078125,
      7487.85791015625
    ]
  },
  {
    "key": "riften-interior-test-v1",
    "routeId": "admin-test",
    "quest": 2053,
    "reference": 2309,
    "title": "Frostveil: Navigation Test",
    "destination": "The Bee and Barb, Riften (test only)",
    "cell": "16bdf:skyrim.esm",
    "pos": [
      -195.9238739013672,
      -545.3919677734375,
      64
    ],
    "testOnly": true,
    "approaches": [
      {
        "cell": "3c:skyrim.esm",
        "reference": 270980
      },
      {
        "cell": "16bb4:skyrim.esm",
        "reference": 274598
      }
    ]
  }
] as const;
