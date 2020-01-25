/**
 * @overview
 * @version 0.2
 * @author graham
 * @copyright 2020
 * @license Hexagonal Awareness License (HAL)
 */

/** @namespace {object} filters */
/** @namespace {object} rules */
/** @namespace {object} util */

var Hexular = (function () {

  // --- SOME EXCITING DEFAULT VALUES ---

  // Default size for cubic (hexagonal) topology
  const DEFAULT_RADIUS = 30;
  // Default size for offset (rectangular) topology
  const DEFAULT_ROWS = 60;
  const DEFAULT_COLS = 60;

  const DEFAULT_RULE = identityRule;
  const DEFAULT_NUM_STATES = 2; // Only used by modulo filter and histogram
  const DEFAULT_GROUND_STATE = 0;

  const DEFAULT_CELL_RADIUS = 10;
  const DEFAULT_BORDER_WIDTH = 1.25;
  const DEFAULT_HIGHLIGHT_COLOR = '#ffbb33';
  const DEFAULT_HIGHLIGHT_LINE_WIDTH = 2;

  const APOTHEM = Math.sqrt(3) / 2;

  var DEFAULT_COLORS = [
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
    '#aa55bb'
  ];

  /**
   * @namespace {object} math
   */
  let math = {
    apothem: APOTHEM,
    inverseApothem: 1 / APOTHEM,
    vertices: [
      [-1, 0],
      [-0.5, -APOTHEM],
      [0.5, -APOTHEM],
      [1, 0],
      [0.5, APOTHEM],
      [-0.5, APOTHEM]
    ],
    basis: [
      [2 * APOTHEM, APOTHEM],
      [0,           1.5]
    ],
    invBasis: [
      [1 / (2 * APOTHEM), -1 / 3],
      [0,                 2 / 3]
    ]
  };

  /**
   * Class representing a hexular error.
   */
  class HexError extends Error {}

  /**
   * @function methodNotImplemented
   *
   * @param {string} [methodName='method'] String description of method - for informational purposes only
   * @throws {HexError}
   * @memberof HexError
   */
  HexError.methodNotImplemented = (methodName = 'method') => {
    throw new HexError(`Method not implemented: "${methodName}"`);
  }

  /**
  * @function validateKeys
  *
  * @param {object} object     Object
  * @param {...string} ...args One or more string or string-coercible keys to check
  * @throws {HexError}
  * @memberof HexError
   */
  HexError.validateKeys = (obj, ...args) => {
    for (let key of args)
      if (!obj[key])
         throw new HexError(`${obj.constructor.name} requires "${key}" to be defined`);
  }

  /**
   * Abstract class representing a grid of cells connected according to some topology
   */
  class Model {
    /**
    * Creates Model instance
    *
    * @param {...object} ...args One or more object of key-value settings to apply to instance
    */
    constructor(...args) {
      let defaults = {
        defaultRule: DEFAULT_RULE,
        numStates: DEFAULT_NUM_STATES,
        groundState: DEFAULT_GROUND_STATE,
        rules: [],
        filters: new HookList(this),
        index: Model.created++,
        cells: [],
      };
      Object.assign(this, defaults, ...args);
      // Add available adapter constructors as direct attributes of this instance
      Object.entries(attributes.classes.adapters).forEach(([className, Class]) => {
        this[className] = (...args) => new Class(this, ...args);
      });
    }

    /**
     * Add filter function to model.
     *
     * @param  {function} filter                  Filter to add
     * @param  {number} [idx=this.filters.length] Optional insertion index (defaults to end of array)
     */
    addFilter(filter, idx=this.filters.length) {
      let boundFilter = filter.bind(this);
      boundFilter.hash = this._hash(filter.toString());
      this.filters.splice(idx, 0, boundFilter);
    }

    /**
     * Remove filter function from model.
     *
     * Since filters are bound to the model, and anonymous functions lack a name, they can't be directly compared to
     * those in `this.filters`, . This we identify and compare functions based on a hash value derived from the string
     * version of the function. The upshot being any identically-coded functions will be equivalent.
     *
     * @param  {function} filter Filter to remove
     */
    removeFilter(filter) {
      let hash = this._hash(filter.toString());
      let idx = this.filters.findIndex(((e) => e.hash == hash));
      if (idx < 0) return;
      this.filters.splice(idx, 1);
      return idx;
    }

    step() {
      this.eachCell((cell) => {
        let nextState = (this.rules[cell.state] || this.defaultRule)(cell);
        cell.nextState = this.filters.call(nextState, cell);
      });
      this.eachCell((cell) => {
        cell.state = cell.nextState;
      });
    }

    clear() {
      this.eachCell((cell) => {
        cell.state = this.groundState;
      });
    }

    setNeighborhood(neighborhood) {
      this.eachCell((cell) => {
        cell.neighborhood = neighborhood;
      })
    }

    eachCoord(callback) { HexError.methodNotImplemented('eachCoord'); }

    eachCell(fn) { HexError.methodNotImplemented('eachCell'); }

    export() {
      let bytes = Int8Array.from(this.cells.map((e) => e.state));
      return bytes;
    }

    import(bytes) {
      this.cells.forEach((cell, idx) => {
        cell.state = bytes[idx] || this.groundState;
      });
    }

    /**
     * Internal hashing function to track bound functions. Not actually important.
     *
     * @param  {string} str Some string
     * @return {string}     Chunked, summed mod 256 hexadecimal string
     */
    _hash(str) {
      let bytes = new Uint8Array(str.split('').map((e) => e.charCodeAt(0)));
      let chunkSize = Math.max(2, Math.ceil(bytes.length / 16));
      let chunked = bytes.reduce((a, e, i) => {
        a[Math.floor(i / chunkSize)] += e;
        return a;
      }, Array(Math.ceil(bytes.length / chunkSize)).fill(0));
      return chunked.map((e) => ('0' + (e % 256).toString(16)).slice(-2)).join('');
    }
  }
  Model.created = 0;

/**
 * Class representing an offset, i.e. rectangular, topology.
 *
 * In an offset topology, cells describe a cols x rows grid where every other row is staggered one apothem-length
 * along the x axis. This is useful when trying to fit a grid into a rectangular box, but may cause undesirable
 * wraparound effects. (These effects may be mitigated by using `edgeFilter`.)
 */

  class OffsetModel extends Model {
    /**
    * Creates OffsetModel instance
    *
    * @param {...object} ...args One or more object of key-value settings to apply to instance
    */
    constructor(...args) {
      super();
      let defaults = {
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        cells: [],
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'rows', 'cols');
      let rows = this.rows, cols = this.cols;
      this.eachCoord(([i, j]) => {
        // Being on an edge affects draw actions involving neighbors
        let edge = (i == 0 || i == this.cols - 1 || j == 0 || j == rows - 1);
        this.cells.push(new Cell(this, [i, j], {edge}));
      });

      // Connect simple neighbors
      this.eachCell((cell, [i, j]) => {
        let upRow = mod(j - 1, rows);
        let downRow = mod(j + 1, rows);
        let offset = downRow % 2;

        cell.nbrs[1] = this.cells[downRow * cols + mod(i - offset + 1, cols)];
        cell.nbrs[2] = this.cells[j * cols + mod(i + 1, cols)];
        cell.nbrs[3] = this.cells[upRow * cols + mod(i - offset + 1, cols)];
        cell.nbrs[4] = this.cells[upRow * cols + mod(i - offset, cols)];
        cell.nbrs[5] = this.cells[j * cols + mod(i - 1, cols)];
        cell.nbrs[6] = this.cells[downRow * cols + mod(i - offset, cols)];
      });

      // Connect extended neighbors
      this.eachCell((cell) => {
        cell.extendNeighborhood();
      });
    }

    eachCoord(fn) {
      for (let j = 0; j < this.rows; j++) {
        for (let i = 0; i < this.cols; i++) {
          if (fn([i, j]) === false) return false;
        }
      }
      return true;
    }

    eachCell(fn) {
      return this.eachCoord(([i, j]) => {
        let cell = this.cells[j * this.cols + i];
        return fn(cell, [i, j]);
      });
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [i, j] = cell.coord;

      // Like converting to cubic coords but mod 2 wrt x offset
      let x = renderer.basis[0][0] * i + renderer.basis[0][1] * (j % 2);
      let y = renderer.basis[1][0] * i + renderer.basis[1][1] * j;
      return [x, y];
    }

    cellAtCubic([u, v, w]) {
      // For offset, we shift every two rows to the left
      v += u >> 1;
      let cell = this.cells[u * this.cols + v];
      return cell;
    }
  }

  /**
   * Class representing a hexagonal model with cells addressed using cubic coordinates.
   *
   * Here we describe a hexagnal grid of cells addressed by coordinates `[u, v, w]`. The cell at the origin is
   * designated `[0, 0, 0]`, with tuples of coordinates summing to zero. In the default display provided by
   * {@link CanvasAdapter}, the `u` points up, `v` points to the right, and `w` points to the left.
   *
   * For more information on this system, and how it translates to other coordinate systems, please see the excellent
   * article [Hexagonal Grids]{@link https://www.redblobgames.com/grids/hexagons/} from Red Blob Games.
   */

  class CubicModel extends Model {
    /**
    * Creates CubicModel instance.
    *
    * @param {...object} ...args One or more object of key-value settings to apply to instance
    */
    constructor(...args) {
      super(...args);
      let radius = this.radius = this.radius || DEFAULT_RADIUS;
      HexError.validateKeys(this, 'radius');
      this.size = radius * (radius - 1) * 3 + 1;
      let max = this.max = radius - 1;
      let cols = this.cols = radius * 2 - 1;
      this.rhombus = Array(cols * 2).fill(null);

      this.eachCoord(([u, v, w]) => {
          // Being on an edge affects draw actions involving neighbors
          let edge = absMax(u, v, w) == max;
          this.rhombus[u * cols + v] = new Cell(this, [u, v, w], {edge});
      });

      // Connect simple neighbors
      Object.values(this.rhombus).filter((e) => e).forEach((cell) => {
        for (let i = 0; i < 6; i++) {
          let dir1 = i >> 1;
          let dir2 = (dir1 + 1 + i % 2) % 3;
          let dir3 = (dir1 + 1 + +!(i % 2)) % 3;
          let nbr = cell.coord.slice();
          nbr[dir1] += 1;
          nbr[dir2] -= 1;
          nbr[dir3] = -nbr[dir1] - nbr[dir2];
          for (let dir of [dir1, dir2, dir3]) {
            if (Math.abs(nbr[dir]) > max) {
              let sign = Math.sign(nbr[dir]);
              let dirA = (dir + 1) % 3;
              let dirB = (dir + 2) % 3;
              nbr[dir] -= sign * cols;
              nbr[dirA] += sign * max;
              nbr[dirB] = -nbr[dir] - nbr[dirA];
            }
          }
          cell.nbrs[1 + (i + 5) % 6] = this.rhombus[nbr[0] * cols + nbr[1]];
        }
      });

      // Populate cell array via neighbor traversal
      // Our goal here is to put cells into center-out mapping so they can be saved and restored between board sizes
      // This will not work OffsetModel b/c there's no way to infer what size rectangle the cells were on originally
      this.cells = [this.rhombus[0]];
      for (let i = 1; i < this.radius; i++) {
        let cell = this.cells[0];
        // We select the first simple neighbor in the i-th ring
        for (let j = 0; j < i; j++)
          cell = cell.nbrs[1];

        for (let j = 0; j < 6; j++) {
          let dir = 1 + (j + 2) % 6;
          for (let k = 0; k < i; k++) {
            cell = cell.nbrs[dir];
            this.cells.push(cell);
          }
        }
      }

      // Connect extended neighbors
      this.eachCell((cell) => {
        cell.extendNeighborhood();
      });
    }

    eachCoord(fn) {
      for (let u = -this.max; u < this.radius; u++) {
        for (let v = -this.max; v < this.radius; v++) {
          let w = -u - v;
          if (Math.abs(w) > this.max) continue;
          if (fn([u, v, -u - v]) === false) return false;
        }
      }
      return true;
    }

    eachCell(fn) {
      let a = [];
      for (let i = 0; i < this.cells.length; i++) {
        a.push(fn(this.cells[i]));
      }
      return a;
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [u, v, w] = cell.coord;

      let [x, y] = matrixMult(renderer.basis, [v, u]);
      return [x, y];
    }

    cellAtCubic([u, v, w]) {
      if (absMax(u, v, w) > this.max)
        return null;
      let cell = this.rhombus[u * this.cols + v];
      return cell;
    }
  }

  /**
   * Class representing a cell.
   */

  class Cell {
    constructor(model, coord, ...args) {
      let defaults = {
        model,
        coord,
        state: model.groundState,
        nextState: 0,
        nbrs: new Array(19).fill(null),
        neighborhood: 6,
      };
      Object.assign(this, defaults, ...args);
      this.nbrs[0] = this;
      this.with = {
        6: new Neighborhood(this, 1, 7),
        12: new Neighborhood(this, 1, 13),
        18: new Neighborhood(this, 1, 19),
        7: new Neighborhood(this, 0, 7),
        13: new Neighborhood(this, 0, 13),
        19: new Neighborhood(this, 0, 19),
      };
    }

    extendNeighborhood() {
      for (let i = 1; i < 7; i++) {
        let source12 = 1 + (i + 4) % 6;
        this.nbrs[i + 6] = this.nbrs[i].nbrs[source12];
        this.nbrs[i + 12] = this.nbrs[i].nbrs[i];
      }
    }

    get total() { return this.with[this.neighborhood].total; }

    get count() { return this.with[this.neighborhood].count; }

    get histogram() { return this.with[this.neighborhood].histogram; }
  }

  /**
   * Class representing a neighborhood around a cell.
   *
   * A cell's `nbrs` array contains 19 entries, starting with itself. By selecting particular subsets of this array,
   * we can confine our iteration to the 6, 12, or 18 nearest neighbors, with or without the cell itself.
   */
  class Neighborhood {
    constructor(cell, min, max) {
      this.cell = cell;
      this.nbrs = cell.nbrs;
      this.min = min;
      this.max = max;
      this.length = max - min;
    }

    get total() {
      let a = 0;
      for (let i = this.min; i < this.max; i++)
        a += this.nbrs[i].state;
      return a;
    }

    get count() {
      try {
      let a = 0;
      for (let i = this.min; i < this.max; i++)
        a += this.nbrs[i].state ? 1 : 0;
      return a;} catch (e) {console.log(this,this.cell,this.cell.coord); console.trace(); throw e;}
    }

    get histogram() {
      let a = Array(this.numStates).fill(0);
      for (let i = this.min; i < this.max; i ++)
        a[this.nbrs[i].state] += 1;
      return a;
    }
  }

  /**
   * Class representing a list of callback hooks
   */
  class HookList extends Array {
    constructor(owner) {
      super();
      this.owner = owner;
    }

    call(val, ...args) {
      for (let i = 0; i < this.length; i++) {
        let newVal = this[i].call(this.owner, val, ...args);
        val = newVal === undefined ? val : newVal;
      }
      return val;
    }
  }

  /**
   * Abstract class representing an adapter.
   *
   * This doesn't really do much.
   */
  class Adapter {
    draw() { HexError.methodNotImplemented('draw'); }
  }

  /**
   * Class represting a renderer bound to two user agent canvas elements.
   */
  class CanvasAdapter extends Adapter {
    /**
    * Creates CanvasAdapter instance
    *
    * @param {Model} model       Model to associate with this adapter
    * @param {...object} ...args One or more object of key-value settings to apply to instance
    */
    constructor(model, ...args) {
      super();
      let defaults = {
        model,
        cellMap: new Map(),
        colors: DEFAULT_COLORS,
        highlightColor: DEFAULT_HIGHLIGHT_COLOR,
        highlightLineWidth: DEFAULT_HIGHLIGHT_LINE_WIDTH,
        cellRadius: DEFAULT_CELL_RADIUS,
        borderWidth: DEFAULT_BORDER_WIDTH,
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'renderer', 'selector', 'cellRadius');

      // Precomputed math stuff

      this.innerRadius = this.cellRadius - this.borderWidth / (2 * math.apothem);
      this.vertices = scalarOp(math.vertices, this.innerRadius);
      this.basis = scalarOp(math.basis, this.cellRadius);

      // For imageData rectangle coords
      this.selectYOffset = Math.ceil(
        this.cellRadius * math.apothem + this.highlightLineWidth);
      this.selectXOffset = Math.ceil(
        this.cellRadius + this.highlightLineWidth);
      this.selectHeight = this.selectYOffset * 2;
      this.selectWidth = this.selectXOffset * 2;

      // Callback hooks for drawing actions

      this.onDrawCell = new HookList(this);
      this.onDrawCell.push(this.defaultDrawCell);

      this.onDrawSelector = new HookList(this);
      this.onDrawSelector.push(this.defaultDrawSelector);
      this.selected = {
        cell: null,
        x: 0,
        y: 0
      };

      this.model.eachCell((cell) => {
        this.cellMap.set(cell, this.model.getCoords(this, cell));
      });
    }

    // Draw all cells

    draw() {
      this.clear(this.renderer);
      this.model.eachCell((cell) => {
        this.drawCell(cell);
      });
    }

    // Select cell and highlight on canvas

    selectCell(cell) {
      if (this.selected.cell != cell) {
        this.clear(this.selector);
        if (cell) {
          let [x, y] = this.cellMap.get(cell);
          this.selected.x = x - this.selectXOffset;
          this.selected.y = y - this.selectYOffset;
          this.drawSelector(cell);
        }
        this.selected.cell = cell;
      }
    }

    clear(ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

    // Draw actions

    drawCell(cell) {
      this.onDrawCell.call(cell);
    }

    drawSelector(cell) {
      this.onDrawSelector.call(cell);
    }

    defaultDrawCell(cell) {
    // Use cell.owner when writing custom drawing callbacks
    this.drawHexPath(this.renderer, cell);
    this.renderer.fillStyle = this.colors[cell.state];
    this.renderer.fill();
  }

    defaultDrawSelector(cell) {
    this.drawHexPath(this.selector, cell);

    this.selector.strokeStyle = this.highlightColor;
    this.selector.lineWidth = this.highlightLineWidth;
    this.selector.stroke();
  }

    // Basic cell path for both cells and selector

    drawHexPath(ctx, cell) {
      const [x, y] = this.cellMap.get(cell);
      const vertices = this.vertices;
      ctx.beginPath();
      ctx.moveTo(x + vertices[0][1], y + vertices[0][0]);
      ctx.lineTo(x + vertices[1][1], y + vertices[1][0]);
      ctx.lineTo(x + vertices[2][1], y + vertices[2][0]);
      ctx.lineTo(x + vertices[3][1], y + vertices[3][0]);
      ctx.lineTo(x + vertices[4][1], y + vertices[4][0]);
      ctx.lineTo(x + vertices[5][1], y + vertices[5][0]);

      ctx.closePath();
    }

    // Get cell at y,x coords on canvas

    cellAt([x, y]) {
      // First convert to cubic coords
      let rawCubic = cartesianToCubic([x, y]);
      let cubic = roundCubic(rawCubic, this.cellRadius);
      let cell = this.model.cellAtCubic(cubic);
      return cell;
    }
  }

  // TODO: Add SVG adapter

  // --- DEFAULT CELL CALLBACKS ---

  /**
   * A rule that returns the current state.
   *
   * @memberof rules
   */
  function identityRule(cell) {
    return cell.state;
  }

  /**
   * A rule that returns 0.
   *
   * Debatably, this should return `model.groundState`, but for various reasons it doesn't.
   *
   * @memberof rules
   */
  function nullRule(cell) {
    return 0;
  }

  // --- OPTIONAL FILTERS ---

  /**
   * Set new cell values to modulus with respect to `this.numStates`.
   *
   * This has the effect of making states cyclical. Historically this was the default behavior. Not ethat there is,
   * in principle, preventing one from using non-numeric or complex multivalued cell states, but like much of the
   * boilerplate functionality, this filter is implemented with the assumption that states will be natural numbers.
   *
   * @memberof filters
   */
  function modFilter(value) {
   return mod(value, this.numStates);
  }

  /**
   * Always set edge cells to ground state.
   *
   * This has the effect of disabling wraparound cells, since no cell state can affect a cell neighborhood across the
   * 2 cell boundary width. This may have unexpected and undesirable effects with certain rules though.
   *
   * @memberof filters
   */
  function edgeFilter(value, cell) {
    return !cell.edge ? value : this.groundState;
  }

  /**
  * Generates an elementary rule based on 6/7-bit state of cell neighbors + optionally itself.
  *
  * Modeled roughly after Wolfram's
  * [Elementary Cellular Automaton]{@link http://mathworld.wolfram.com/ElementaryCellularAutomaton.html} rules.
  *
  * @param {bigint|number[]} ruleDef 128-bit number indicating next position per possible state, or array of 7-bit
  *                                  numbers giving individual states where next cell state is 1
  * @param {bool} [inc=false]        Whether to include cell state in neighborhood
  * @memberof util
  **/
  function ruleBuilder(ruleDef, inc=false) {
    let n
    if (typeof ruleDef == 'object') {
      n = 0n;
      for (let state of ruleDef) {
        n = n | 1n << BigInt(state);
      }
    }
    else {
      n = BigInt(n);
    }
    let startIdx = +!inc;
    return (cell) => {
      let mask = 0;
      for (let i = startIdx; i < 7; i++) {
        mask = mask | (cell.nbrs[i].state ? 1 : 0) << (6 - i);
      }
      return Number((n >> BigInt(mask)) % 2n);
    };
  }

  // --- UTILITY FUNCTIONS ---

  /**
   * Modulo operation for reals.
   *
   * @param  {number} a Dividend
   * @param  {number} n Divisor
   * @return {number} Modulus
   * @memberof math
   */
  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  /**
   * Perform element-wise arithmetic operation on arbitrarily-dimensioned tensor.
   *
   * @param  {number[]} obj    Arbitrary-dimensional array of numbers
   * @param  {number} scalar   Scalar
   * @param  {string} [op='*'] Either '+' or '*' - for subtraction or division, invert `scalar` argument
   * @return {number[]}        Result array with same shape as `obj`
   * @memberof math
   */
  function scalarOp(obj, scalar, op) {
    if (obj.map)
      return obj.map(function(val, i) {
        return scalarOp(val, scalar, op);
      });
    else
      return op == '+' ? obj + scalar : obj * scalar;
  }

  /**
   * Multiply row-major matrix by another matrix or transposed 1D vector (i.e. right-multiply matrix by vector).
   *
   * @param  {number[][]} a          2D array representing m*n matrix where outer length = m and inner length = n
   * @param  {number[][]|number[]} b 2D array representing p*q matrix or 1D array representing q-length vector
   * @return {number[][]}            2D array representing m*q matrix
   * @memberof math
   */
  function matrixMult(a, b) {
    let v = !Array.isArray(b[0])
    b = v ? [b] : b;
    let product = b.map((bCol) => {
      let productRow = [];
      for (let aRow = 0; aRow < a.length; aRow++) {
        productRow.push(bCol.reduce((acc, bEntry, aCol) => {
          return acc + a[aRow][aCol] * bEntry;
        }, 0));
      }
      return productRow;
    });
    return v ? product[0] : product;
  }

  /**
   * Element-wise addition of two identical-length arrays.
   *
   * @param  {array} u N-dimensional first argument
   * @param  {array} v N-dimensional Second argument
   * @return {array}   N-dimensional sum
   * @memberof math
   */
  function vectorAdd(u, v) {
    return Array.isArray(u) ? u.map((e, i) => add(e, v[i])) : u + v;
  }

  /**
   * Helper function for finding max of absolute values.
   *
   * @param  {...number} ...args Real numbers
   * @return {number}            Maximum argument absolute value
   * @memberof math
   */
  function absMax(...args) {
    return Math.max(...args.map((e) => Math.abs(e)));
  }

  /**
   * Convert x, y coordinates to cubic coordinates u, v, w.
   *
   * @param  {array} coord Two-member array of coordinates x, y
   * @return {array}       Raw (real) cubic coordinates [u, v, w]
   * @memberof math
   */
  function cartesianToCubic([x, y]) {
    let [v, u] = matrixMult(math.invBasis, [x, y]);
    let w = -u - v;
    return [u, v, w];
  }

  /**
   * Convert real-valued u, v, w to rounded, whole-number coordinates.
   *
   * @param  {array} coord       Array of real-valued cubic coordinates u, v, w
   * @param  {number} [radius=1] radius Optional radius scalar - for converting "pixel" coords to "cell" coords
   * @return {array}             Integer cubic coordinates [u, v, w]
   * @memberof math
   */
  function roundCubic([u, v, w], radius) {
    radius = radius || 1;

    let ru = Math.round(u / radius);
    let rv = Math.round(v / radius);
    let rw = Math.round(w / radius);
    // TODO: Do this better
    let du = Math.abs(ru - u);
    let dv = Math.abs(rv - v);
    let dw = Math.abs(rw - w);

    if (du > dv && du > dw)
      ru = -rv - rw;
    else if (du > dw)
      rv = -ru - rw;
    return [ru, rv, rw];
  }

  // ---

  let attributes = {
    defaults: {
      model: CubicModel
    },
    rules: {
      identityRule,
      nullRule,
    },
    filters: {
      modFilter,
      edgeFilter,
    },
    util: {
      ruleBuilder,
    },
    math: Object.assign(math, {
      mod,
      scalarOp,
      matrixMult,
      vectorAdd,
      absMax,
      cartesianToCubic,
      roundCubic,
    }),
    classes: {
      adapters: {
        CanvasAdapter,
      },
      models: {
        OffsetModel,
        CubicModel,
      },
      HexError,
      Model,
      Cell,
      HookList,
      Adapter,
    },
  };

  /**
   * Principal function object assigned to global `Hexular` object or returned as module.
   *
   * @param  {...object} ...args Arguments to pass to Model constructor
   * @return {Model}             Model instance
   * @global
   */
  const Hexular = (...args) => {
    let Class = (args[0].prototype instanceof Model) ? args.shift() : attributes.defaults.model;
    return new Class(...args);
  }

  Object.assign(Hexular, attributes);

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;
