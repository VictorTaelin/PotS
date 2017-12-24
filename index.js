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
    pos: {x: 0, y: 200},
    vel: {x: 0, y: 0},
    dir: 1,
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
      var pad = self.vel.x <= 40 ? (self.pad.right - self.pad.left) * 160 : 0;
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
        if (thing.pair && !isZero(uncollideFrom(thing, self, false)) && self.warpCooldown <= 0) {
          console.log("wap");
          //console.log(thing.nrm, self.vel);
          var nrm = clk(clk(thing.nrm));
          var fwd = clk(clk(thing.fwd));
          var dxy = sub(thing.pos, self.pos);
          var vel = {x: self.vel.x, y: self.vel.y};
          while (nrm.x !== thing.pair.nrm.x || nrm.y  !== thing.pair.nrm.y) {
            dxy = clk(dxy);
            vel = clk(vel);
            nrm = clk(nrm);
            fwd = clk(fwd);
            //console.log(nrm, thing.pair.nrm);
          }
          if (!eql(fwd, thing.pair.fwd)) {
            console.log(fwd, thing.pair.fwd);
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

      const doActions = self.actions;
      self.actions = [];
      return doActions;
    },
    key: (self, key, pressed) => {
      switch (key) {
        case "a":
          self.pad.left = pressed;
          break;
        case "s":
          self.pad.down = pressed;
          break;
        case "d":
          self.pad.right = pressed;
          break;
        case "w":
          self.pad.up = pressed;
          break;
        case " ": 
          if (self.grounded) {
            self.vel.y = 300;
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
    interact(self, things, thing => {
      if (thing.solid) {
        var uncollide = uncollideFrom(thing, self);
        self.pos.x += uncollide.x;
        self.pos.y += uncollide.y;
        if (!isZero(uncollide)) {
          norm = nrm(uncollide);
        }
      }
    });
    if (norm) { 
      portal.pos.x = self.pos.x + norm.x * 8 * 0.5;
      portal.pos.y = self.pos.y + norm.y * 8 * 0.5;
      portal.nrm.x = norm.x;
      portal.nrm.y = norm.y;
      if (self.vel.x * norm.y - self.vel.y * norm.x > 0) {
        portal.fwd = clk(portal.nrm);
      } else {
        portal.fwd = clk(clk(clk(portal.nrm)));
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

const Wall = (x, y, w, h, portal) => ({
  id: rnd(),
  pos: {x: x, y: y},
  size: {x: w, y: h},
  portal: portal || 0,
  solid: 1,
  draw: (self, ctx) => {
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
      = self.portal
      ? "rgba(160,255,160,0.8)"
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

  // Initial setup
  var things = [];

  // Main hero
  var hero = Hero(murkySprites);
  things.push(hero);

  // Floor and boundary
  things.push(Wall(0, -1000, 2000, 1000));
  things.push(Wall(-1200, 0, 1000, 2000));
  things.push(Wall(-176, 0, 30, 30, 1));

  // Init stone
  things.push(Wall(0, 0, 20, 20));

  // Struct
  //things.push(Wall(-500, 0, 100, 100));
  //things.push(Wall(-500, 0, 200, 50));
  //things.push(Wall(-600, 0, 100, 600));

  // ...
  //things.push(Wall(-500, 500, 200, 60));

  // Controls
  document.onkeydown = e => hero.key(hero, e.key, 1);
  document.onkeyup = e => hero.key(hero, e.key, 0);
  canvas.onmousedown = e => {
    if (e.button === 0 || e.button === 2) {
      hero.click(hero, {
        x: e.pageX - e.target.offsetLeft - canvas.width * 0.5 + hero.pos.x,
        y: -e.pageY + e.target.offsetTop + canvas.height * 0.8 + hero.pos.y
      }, e.button);
      e.preventDefault();
    }
  };
  canvas.onmousemove = e => {
    console.log({
      x: e.pageX - e.target.offsetLeft - canvas.width * 0.5 + hero.pos.x,
      y: -e.pageY + e.target.offsetTop + canvas.height * 0.8 + hero.pos.y
    });
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
        ctx.translate(canvas.width * 0.5 - hero.pos.x, canvas.height * 0.8 + hero.pos.y);
        if (things[i][method]) {
          things[i][method](things[i], ctx);
        }
        ctx.resetTransform();
      }
    });

    window.requestAnimationFrame(render);
  });

  setInterval(() => {
    console.log(hero.pos);
  }, 500);
};



































