// () => Number
const rnd = () => Math.random();
const len = (a) => Math.sqrt(a.x * a.x + a.y * a.y);
const nrm = (a) => ({x: a.x / len(a), y: a.y / len(a)});
const sub = (a,b) => ({x: a.x - b.x, y: a.y - b.y});
const clk = (a) => ({x: a.y, y: -a.x});
const eql = (a,b) => a.x === b.x && a.y === b.y;

// Box, Square -> {x: Number, y: Number}
// How much square `b` needs to move to "uncollide" from box `a`.
// If both aren't colliding, returns {x:0, y:0}.
const uncollideFrom = (a, b, useVel) => {
  var {x:ax, y:ay} = a.pos;
  var {x:bx, y:by} = b.pos;
  var {x:aw, y:ah} = a.size;
  var {x:bw, y:bh} = b.size;
  var {x:vx, y:vy} = b.vel;
  if ( Math.abs(ax - bx) < (aw + bw)
    && Math.abs(ay - by) < (ah + bh)) {
    var dx = ax - bx;
    var dy = ay - by;
    if (dx < dy * aw / ah) {
      if (-dx < dy * aw / ah && (!useVel || vy > 0)) { // b above a
        return {x: 0, y: (ay - ah) - (by + bh)};
      } else if (!useVel || vx < 0) { // b right of a
        return {x: (ax + aw) - (bx - bw), y: 0};
      }
    } else {
      if (-dx < dy * aw / ah && (!useVel || vx > 0)) { // b left of a
        return {x: (ax - aw) - (bx + bw), y: 0};
      } else if (!useVel || vy < 0) { // b below a
        return {x: 0, y: (ay + ah) - (by - bh)};
      }
    }
  }
  return {x: 0, y: 0};
};

// Vector2D -> Bool
const isZero = a => a.x === 0 && a.y === 0;

// Thing, Number -> Thing
const integrate = (self, dt) => {
  self.pos.x += self.vel.x * dt;
  self.pos.y += self.vel.y * dt;
};

// Thing, [Thing], (Thing -> Effect) -> ()
const interact = (self, things, callback) => {
  for (var i = 0; i < things.length; ++i) {
    var other = things[i];
    if (other === self) {
      continue;
    }
    callback(things[i]);
  }
};

const drawHitbox = (self, ctx) => {
  ctx.beginPath();
  ctx.fillStyle = "rgb(100,0,0)";
  ctx.rect(
    + self.pos.x - self.size.x,
    - self.pos.y - self.size.y,
    + self.size.x * 2 + 3,
    + self.size.y * 2 + 3);
  ctx.fill();
  ctx.beginPath();
};

const Hero = (sprites) => {
  return {
    id: rnd(),
    pad: {left: 0, right: 0, up: 0, down: 0},
    //pos: {x: 3763, y: 360}, // INI
    pos: {x: 0, y: 200}, // INI
    vel: {x: 0, y: 0},
    dir: 1,
    boh: 0,
    size: {x: 24, y:24},
    grounded: 0,
    actions: [],
    portals: null,
    time: 0,
    draw: (self, ctx) => {
      ctx.beginPath();
      ctx.fillStyle = "rgba(100,100,100,0.5)";
      var sheet = sprites.standing[self.dir === 1 ? "right" : "left"];
      ctx.drawImage(
        sheet[self.time % 0.7 <= 0.35 ? 0 : 1],
        + self.pos.x - self.size.x - 8,
        - self.pos.y - self.size.y - 8);
      //ctx.rect(
        //+ self.pos.x - self.size.x,
        //- self.pos.y - self.size.y,
        //+ self.size.x * 2,
        //+ self.size.y * 2);
      ctx.fill();
    },
    warpCooldown: 0,
    tick: (self, things, dt) => {
      // Portal initialization
      if (!self.portals) {
        var orange = Portal({x: -999999, y: -999999}, "rgba(239,114,46,0.4)");
        var blue = Portal({x: -999999, y: -999999}, "rgba(70,172,233,0.4)");
        orange.pair = blue;
        blue.pair = orange;
        self.portals = {orange, blue};
        self.actions.push(["make", orange], ["make", blue]);
      }

      // Basic movement and collisions
      var pad = self.vel.x <= 40 ? (self.pad.right - self.pad.left) * 160 * (self.boh ? 2 : 1) : 0;
      if (pad > 0 && self.dir < 0 || pad < 0 && self.dir > 0) self.dir = -self.dir;
      self.vel.x += pad;
      self.vel.y -= 12;
      self.vel.x = Math.min(1000, Math.max(-600, self.vel.x));
      self.vel.y = Math.min(1000, Math.max(-600, self.vel.y));
      self.grounded = 0;
      integrate(self, dt);
      interact(self, things, thing => {
        if (thing.solid) {
          var uncollide = uncollideFrom(thing, self, true);
          self.pos.x += uncollide.x;
          self.pos.y += uncollide.y;
          if (thing.lava && !isZero(uncollide)) {
            self.pos.x = 0;
            self.pos.y = 100;
          }
          if (uncollide.x !== 0) {
            self.vel.x = pad;
          }
          if (uncollide.y !== 0) {
            self.vel.y = 0;
          }
          if (uncollide.y > 0) {
            self.grounded = 1;
          }
        }
      });
      self.vel.x -= pad;
      self.vel.x *= self.grounded ? Math.pow(0.01, dt) : 1;

      // Time
      self.time += dt;

      // Warping
      self.warpCooldown -= dt;
      interact(self, things, thing => {
        if (thing.pair
          && !isZero(uncollideFrom(thing, self, false))
          && self.warpCooldown <= 0
          && thing.pos.x > -999999
          && thing.pair.pos.x > -999999) {
          var nrm = clk(clk(thing.nrm));
          var fwd = clk(clk(thing.fwd));
          var dxy = sub(thing.pos, self.pos);
          var vel = {x: self.vel.x, y: self.vel.y};
          while (nrm.x !== thing.pair.nrm.x || nrm.y  !== thing.pair.nrm.y) {
            dxy = clk(dxy);
            vel = clk(vel);
            nrm = clk(nrm);
            fwd = clk(fwd);
          }
          if (!eql(fwd, thing.pair.fwd)) {
            if (thing.pair.nrm.x === 0) {
              dxy.x *= -1;
              vel.x *= -1;
            } else {
              dxy.y *= -1;
              vel.y *= -1;
            };
          }
          self.warpCooldown = 0.35;
          self.pos.x = thing.pair.pos.x + dxy.x;
          self.pos.y = thing.pair.pos.y + dxy.y;
          self.vel.x = vel.x + nrm.x * 120 / (1 + Math.abs(vel.x) * 0.1);
          self.vel.y = vel.y + nrm.y * 120 / (1 + Math.abs(vel.y) * 0.1);
        }
      });

      // Boh
      interact(self, things, thing => {
        if (thing.isBoh && !isZero(uncollideFrom(thing, self, false))) {
          self.actions.push(["kill", thing]);
          self.boh = 1;
        }
      });

      const doActions = self.actions;
      self.actions = [];
      return doActions;
    },
    key: (self, key, pressed) => {
      switch (key) {
        case "a":
          self.pad.left = pressed;
          break;
        case "d":
          self.pad.right = pressed;
          break;
        case " ": 
        case "w": 
          if (self.grounded) {
            self.vel.y = 340 * (self.boh ? 1.8 : 1);
            self.grounded = 0;
          }
          break;
      }
    },
    click: (self, pos, button) => {
      var spd = 800;
      var dxy = {x: pos.x - self.pos.x, y: pos.y - self.pos.y};
      var len = Math.sqrt(dxy.x * dxy.x + dxy.y * dxy.y);
      var vel = {x: dxy.x / len * spd, y: dxy.y / len * spd};
      var pos = {x: self.pos.x, y: self.pos.y};
      var portal = button === 0 ? self.portals.blue : self.portals.orange;
      var shot = PortalShot(pos, vel, portal);
      self.actions.push(["make", shot]);
    }
  }
};

const PortalShot = (pos, vel, portal) => ({
  id: rnd(),
  pos: pos,
  vel: vel,
  size: {x: 6, y: 6},
  draw: (self, ctx) => {
    ctx.beginPath();
    ctx.fillStyle = portal.color;
    ctx.arc(
      + self.pos.x - self.size.x,
      - self.pos.y - self.size.y,
      + self.size.x + 2,
      0,
      2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
  },
  tick: (self, things, dt) => {
    integrate(self, dt);
    var norm = null;
    var warp = false;
    interact(self, things, thing => {
      if (thing.solid) {
        var uncollide = uncollideFrom(thing, self);
        self.pos.x += uncollide.x;
        self.pos.y += uncollide.y;
        if (!isZero(uncollide)) {
          norm = nrm(uncollide);
          warp = thing.warp;
        }
      }
    });
    if (norm) { 
      if (warp) {
        portal.pos.x = self.pos.x + norm.x * 8 * 0.5;
        portal.pos.y = self.pos.y + norm.y * 8 * 0.5;
        portal.nrm.x = norm.x;
        portal.nrm.y = norm.y;
        if (self.vel.x * norm.y - self.vel.y * norm.x > 0) {
          portal.fwd = clk(portal.nrm);
        } else {
          portal.fwd = clk(clk(clk(portal.nrm)));
        }
      }
      return [["kill", self]];
    }
    return [];
  }
});

const Portal = (pos, color) => ({
  id: rnd(),
  pos: pos,
  vel: {x: 0, y: 0},
  nrm: {x: 0, y: 0},
  fwd: {x: 0, y: 0},
  pair: null,
  size: {x: 20, y: 20},
  color: color,
  tick: (self, things, dt) => {
    self.size.x = 8 + Math.abs(self.nrm.y) * 16;
    self.size.y = 8 + Math.abs(self.nrm.x) * 16;
    return [];
  },
  draw: (self, ctx) => {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.rect(
      + self.pos.x - self.size.x,
      - self.pos.y - self.size.y,
      + self.size.x * 2,
      + self.size.y * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(
      + self.pos.x - 4 + self.fwd.x * self.size.x * 0.5,
      - self.pos.y - 4 - self.fwd.y * self.size.y * 0.5,
      + 8,
      + 8);
    ctx.fill();
  }
});

const Boh = (pos, sprite) => ({
  id: rnd(),
  pos: pos,
  vel: {x: 0, y: 0},
  size: {x: 16, y: 16},
  isBoh: 1,
  tick: (self, things, dt) => [],
  draw: (self, ctx) => {
    ctx.drawImage(sprite,
      + self.pos.x - self.size.x,
      - self.pos.y - self.size.y);
  }
});

const Text = (x, y, text, enable) => ({
  id: rnd(),
  pos: {x, y},
  enabled: 0,
  vel: {x: 0, y: 0},
  size: {x: 0, y: 0},
  tick: (self, things, dt) => {
    if (enable()) {
      self.enabled = 1;
    }
    return [];
  },
  draw: (self, ctx) => {
    if (self.enabled) {
      ctx.beginPath();
      ctx.font = "24px arial black";
      ctx.fillStyle = "black";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 0.3;
      ctx.textAlign = "center";
      ctx.fillText(text, self.pos.x, -self.pos.y);
      ctx.strokeText(text, self.pos.x, -self.pos.y);
    }
  }
});



const Wall = (x, y, w, h, opts) => ({
  id: rnd(),
  pos: {x: x, y: y},
  size: {x: w, y: h},
  warp: (opts||{}).warp || 0,
  lava: (opts||{}).lava || 0,
  solid: 1,
  draw: (self, ctx) => {
    if (self.lava) return;
    ctx.beginPath();
    ctx.fillStyle = "rgb(30,30,30)";
    ctx.rect(
      + self.pos.x - self.size.x + 2,
      - self.pos.y - self.size.y + 2,
      + self.size.x * 2 - 4,
      + self.size.y * 2 - 4);
    ctx.fill();
  },
  preDraw: (self, ctx) => {
    ctx.beginPath();
    ctx.fillStyle
      = self.warp
      ? "rgba(160,255,160,0.8)"
      : self.lava
      ? "rgba(80,30,30,0.7)"
      : "rgba(160,160,160,0.5)";
    ctx.rect(
      + self.pos.x - self.size.x,
      - self.pos.y - self.size.y,
      + self.size.x * 2,
      + self.size.y * 2);
    ctx.fill();
    ctx.beginPath();
  },
  tick: (self, things, dt) => []
});

const Rect = (fromX, fromY, toX, toY, warp) => {
  const [w, h] = [(toX - fromX) * 0.5, -(toY - fromY) * 0.5];
  return Wall(fromX + w, fromY - h, w, h, warp);
};

window.onload = () => {
  var canvas = document.createElement("canvas");
  var w = canvas.width = window.innerWidth;
  var h = canvas.height = window.innerHeight;
  var ctx = canvas.getContext("2d");
  ctx.scale(2,2);
  ctx.imageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;
  document.body.appendChild(canvas);

  var image = src => {
    var image = new Image();
    image.src = src;
    image.width = 64;
    image.height = 64;
    return image;
  };
  var murkySprites = {
    standing: {
      left: [image("murky64_0_l.png"), image("murky64_1_l.png")],
      right: [image("murky64_0_r.png"), image("murky64_1_r.png")]
    }
  };
  var bohSprite = image("boh.gif");

  // Initial setup
  var things = [];
  var won = 0;

  // Main hero
  var hero = Hero(murkySprites);
  things.push(hero);

  // Floor and boundary
  things.push(Wall(0, -1000, 6000, 1000));
  things.push(Wall(-2200, 0, 2000, 2000));

  // Initial side-quest (stairs)
  things.push(Wall(-200, 480, 6, 40, {warp:1}));
  things.push(Wall(-200, 100, 6, 40, {warp:1}));
  things.push(Wall(-80, 400 + 80 * 0, 40, 6));
  things.push(Wall(  0, 400 + 80 * 1, 40, 6));
  things.push(Wall(-80, 400 + 80 * 2, 40, 6));
  things.push(Wall(  0, 400 + 80 * 3, 40, 6));
  things.push(Wall(-80, 400 + 80 * 4, 40, 6));
  things.push(Wall(  0, 400 + 80 * 5, 40, 6));
  things.push(Wall(-80, 400 + 80 * 6, 40, 6));
  things.push(Wall(  0, 400 + 80 * 7, 40, 6));
  things.push(Wall(-80, 400 + 80 * 8, 40, 6));
  things.push(Wall(  0, 400 + 80 * 9, 40, 6));
  things.push(Wall(-80, 400 + 80 * 10, 40, 6));
  things.push(Wall(  0, 400 + 80 * 11, 40, 6));
  things.push(Wall(-80, 400 + 80 * 12, 40, 6));
  things.push(Wall(  0, 400 + 80 * 13, 40, 6));
  things.push(Wall(-80, 400 + 80 * 14, 40, 6));
  things.push(Wall(  0, 400 + 80 * 15, 40, 6));
  things.push(Wall(-80, 400 + 80 * 16, 40, 6));
  things.push(Wall(  0, 400 + 80 * 17, 40, 6));
  things.push(Wall(-80, 400 + 80 * 18, 40, 6));

  // First challenge: boxes and lava
  things.push(Rect(200, 60, 920, -20));
  things.push(Rect(240, 120, 920, -20));
  things.push(Rect(280, 180, 920, -20));
  things.push(Rect(550, 320, 630, -20));
  things.push(Rect(550, 580, 630, 540, {warp:1}));
  things.push(Rect(550, 1000, 630, 570));
  things.push(Rect(545, 260, 570, 180, {warp:1}));
  things.push(Rect(620, 260, 635, 180, {warp:1}));
  things.push(Rect(920, 20, 1020, -20, {lava:1}));
  things.push(Rect(1020, 120, 1080, -20));
  things.push(Rect(1080, 20, 1180, -20, {lava:1}));
  things.push(Rect(1180, 120, 1240, -20));
  things.push(Rect(1240, 20, 1340, -20, {lava:1}));
  things.push(Rect(1340, 120, 1400, -20));
  things.push(Rect(1400, 20, 1500, -20, {lava:1}));
  things.push(Rect(1500, 120, 1660, -20));
  things.push(Rect(1660, 20, 1760, -20, {lava:1}));
  things.push(Rect(1760, 240, 1960, -20));
  things.push(Rect(1800, 700, 1920, 400, {warp:1}));
  things.push(Rect(1800, 1600, 1920, 400));
  things.push(Rect(2000, 140, 2220, -20, {warp:1}));
  things.push(Rect(1940, 135, 2280, -20));
  things.push(Rect(2260, 240, 2660, -20));
  things.push(Rect(2360, 450, 2900, 410));
  things.push(Rect(2660, 140, 2900, -20, {lava:1}));
  things.push(Rect(2900, 240, 3200, -20));
  
  // The loop cross
  things.push(Rect(2840, 720, 2900, 660, {warp:1}));
  things.push(Rect(3020, 810, 3080, 750, {warp:1}));
  things.push(Rect(3020, 245, 3080, 205, {warp:1}));
  things.push(Rect(3200, 720, 3260, 660));

  things.push(Rect(3300, 450, 3600, 410));
  things.push(Rect(3200, 450, 3300, 410, {lava:1}));
  things.push(Rect(3200, 140, 3600, -20, {lava:1}));
  things.push(Rect(3380, 420, 3420, 405, {warp:1}));
  things.push(Rect(3600, 240, 4620, -20));

  things.push(Rect(4600, 1000, 6000, -20));
  things.push(Rect(3900, 450, 6000, 300));

  things.push(Rect(2895, 450, 2905, 410, {warp:1}));
  things.push(Rect(3380, 310, 3420, -20));

  things.push(Rect(3900, 1600, 4605, 510));
  things.push(Rect(3900, 515, 3980, 495));
  things.push(Rect(3900, 465, 3980, 445));

  things.push(Rect(4595, 305, 4605, 235, {warp:1}));
  things.push(Rect(4595, 515, 4605, 445, {warp:1}));
  things.push(Boh({x:4010,y:480}, bohSprite));

  // Texts
  things.push(Text(0, 200, "Boa sorte Murkynho!", () => 1));
  things.push(Text(-1500, 2200, "Olhe o console (;", () => hero.pos.x < 500));

  // Controls
  document.onkeydown = e => hero.key(hero, e.key, 1);
  document.onkeyup = e => hero.key(hero, e.key, 0);
  canvas.onmousedown = e => {
    if (e.button === 0 || e.button === 2) {
      hero.click(hero, {
        x: e.pageX - e.target.offsetLeft - canvas.width * 0.5 + hero.pos.x,
        y: -e.pageY + e.target.offsetTop + (canvas.height - 140) + hero.pos.y
      }, e.button);
      e.preventDefault();
    }
  };
  canvas.onmousemove = e => {
    //console.log({
      //x: e.pageX - e.target.offsetLeft - canvas.width * 0.5 + hero.pos.x,
      //y: -e.pageY + e.target.offsetTop + (canvas.height - 140) + hero.pos.y
    //});
  };
  canvas.oncontextmenu = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Main loop
  var lastRender = Date.now();
  window.requestAnimationFrame(function render() {
    var dt = (Date.now() - lastRender) / 1000;
    lastRender = Date.now();

    // Logic
    var kill = {};
    var make = [];
    for (var i = 0; i < things.length; ++i) {
      var actions = things[i].tick(things[i], things, dt);
      for (var j = 0; j < actions.length; ++j) {
        var action = actions[j];
        if (action && action[0] === "kill") {
          kill[action[1].id] = 1;
        } else if (action && action[0] === "make") {
          make.push(action[1]);
        }
      }
    };
    for (var i = 0; i < things.length; ++i) {
      if (!kill[things[i].id]) {
        make.push(things[i]);
      }
    }
    things = make;

    // Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ["preDraw", "draw"].forEach(method => {
      for (var i = things.length - 1; i >= 0; --i) {
        ctx.translate(canvas.width * 0.5 - hero.pos.x, (canvas.height - 140) + hero.pos.y);
        if (things[i][method]) {
          things[i][method](things[i], ctx);
        }
        ctx.resetTransform();
      }
    });

    // Victory
    if (hero.pos.x < -500 && !won) {
      console.log("<3");
      won = 1;
    }

    window.requestAnimationFrame(render);
  });
};



































