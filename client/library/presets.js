const Presets = {
  default: new Preset(Array(12).fill('ennead')),

  bicameralJellyfish: new Preset(
    {
      defaultRule: 'average',
      filters: {clipBottomFilter: true, modFilter: false, edgeFilter: true}
    },
    Object.assign(Array(12).fill('average'), Array(6).fill('bicameral'))
  ),

  binaryFlake: new Preset(Object.assign(Array(10).fill('stepUp'), ['binary1'])),

  enneadPlus: new Preset(
    {filters: {clipBottomFilter: true, modFilter: true, edgeFilter: true}},
    Array(12).fill('enneadPlus')
  ),

  squiggletownClassic: new Preset(Array(13).fill('squiggle6')),

  gliderWorld: new Preset({filters: {binaryFilter: true, edgeFilter: true}}, [
    'ennead',
    'ennead',
  ]),

  grayGoo: new Preset({nh: 19}, Object.assign(Array(10).fill('average'), ['total', 'total'])),

  rainbowRoad: new Preset(Object.assign(Array(12).fill('stepUp'), ['fractalLeft'])),

  rhombicLife: new Preset({filters: {modFilter: false}}, ['rhombicLife', 'rhombicLife']),

  averager: new Preset({filters: {edgeFilter: true}}, Object.assign(Array(12).fill('average'), ['stepDown'])),
  count18: new Preset(
    {filters: {edgeFilter: true, modFilter: false}, nh: 18},
    Object.assign(Array(19).fill('average'), ['count'])
  ),
  identity: new Preset({defaultRule: 'identityRule'}, Array(12).fill('identityRule')),
};
