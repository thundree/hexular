const Themes = (() => {
  // Original 2017 color palette
  let classicColors = Object.assign([], Hexular.DEFAULTS.colors, [
    '#ffffff',
    '#cccccc',
    '#999999',
    '#666666',
    '#333333',
    '#cc4444',
    '#ee7722',
    '#eebb33',
    '#66bb33',
    '#66aaaa',
    '#4455bb',
    '#aa55bb',
  ]);

  const Themes = {
    light: {
      background: '#f8f8f8',
      colors: Hexular.DEFAULTS.colors.slice(),
    },
    smooth: {
      background: '#f8f8f8',
      borderWidth: -0.5,
      colors: Hexular.DEFAULTS.colors.slice(),
    },
    mango: {
      background: '#f8f8f8',
      colors: Hexular.DEFAULTS.colors.slice(0, 5).concat([
        '#cc5555',
        '#ef9f00',
        '#eedd00',
        '#6fbf44',
        '#33cccc',
        '#3366ee',
        '#cc33ee',
      ]),
    },
    classic: {
      background: '#f8f8f8',
      colors: Object.assign([], Hexular.DEFAULTS.colors, [
        '#ffffff',
        '#ccccbb',
        '#99998f',
        '#666655',
        '#33332f',
        '#cc4444',
        '#ee7722',
        '#eebb33',
        '#66bb33',
        '#66aaaa',
        '#4455bb',
        '#aa55bb',
      ]),
    },
    white: {
      background: '#ffffff',
      colors: Hexular.DEFAULTS.colors.slice(),
    },
    beigeRainbow: {
      background: '#ffffff',
      colors: Object.assign([
        '#fafafa',
        '#ccccbb',
        '#ffaa11',
        '#ffcc22',
        '#aadd11',
        '#11cccc',
        '#1188ff',
        '#cc44ff',
        '#ff44bb',
        '#cc3333',
        '#aaaa33',
        '#332211',
      ]),
    },
    dark: {
      background: '#111111',
      borderWidth: -0.25,
      colors: Object.assign([], classicColors, [
        '#000000',
        '#888888',
        '#aaaaaa',
        '#cccccc',
        '#eeeeee',
      ]),
    },
    darkRainbow: {
      background: '#111111',
      borderWidth: -0.25,
      colors: Object.assign([
        '#000000',
        '#ff0000',
        '#ffaa00',
        '#aaff00',
        '#00ff00',
        '#00ffff',
        '#00aaff',
        '#0066ff',
        '#0000ff',
        '#aa00ff',
        '#ff00ff',
        '#ff00aa',
      ]),
    },
  };
  return Themes;
})();