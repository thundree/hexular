class SimpleExpander extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_POINTY,
        drawLast: true,
        drawTerminal: true,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
        lineWidth: null,
        lineJoin: null,
        color: null,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let min = this.settings.minRadius;
    let max = this.settings.maxRadius;
    let r = this.config.innerRadius;
    let q = this.board.drawStepQInc;
    let radius = r * ((max - min) * q + min);
    let maxRadius = r * max;
    let invRadius = r * ((max - min) * (1 - q) + min);
    let opts = {
      type: this.settings.shapeType,
      fill: this.settings.fill,
      stroke: this.settings.stroke,
      lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : this.config.cellBorderWidth,
      lineJoin: this.settings.lineJoin || this.config.defaultJoin,
    };
    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (this.settings.color) {
      fillColors.fill(this.settings.color);
      strokeColors.fill(this.settings.color);
    }

    // Draw
    this.drawEachCell((cell) => {
      let allowed =this.isAllowedState(cell.state);
      let lastAllowed = this.isAllowedState(cell.lastState);
      let fill, stroke;
      if (lastAllowed) {
        opts.fillStyle = fillColors[cell.lastState];
        opts.strokeStyle = strokeColors[cell.lastState];
        if (allowed && this.settings.drawLast) {
          adapter.drawShape(cell,  maxRadius, opts);
        }
        else if (this.settings.drawTerminal) {
          adapter.drawShape(cell, invRadius, opts);
        }

      }
      if (allowed) {
        opts.fillStyle = fillColors[cell.state];
        opts.strokeStyle = strokeColors[cell.state];
        adapter.drawShape(cell, radius, opts);
      }
    });
  }
}
Board.registerPlugin(SimpleExpander);
