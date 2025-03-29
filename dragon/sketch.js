// --- Game Configuration ---
const GRAVITY = 0.5;
const JUMP_FORCE = -12;       // Initial jump velocity
const JUMP_CUT_VELOCITY_FACTOR = 0.4; // Reduce upwards velocity to this fraction when jump key released early
const GROUND_Y_PERCENT = 0.9;
const PLAYER_START_X_PERCENT = 0.1;
const OBSTACLE_START_SPEED = 6;
const OBSTACLE_ACCELERATION = 0.0015;
const OBSTACLE_SPAWN_RATE_MIN = 55;
const OBSTACLE_SPAWN_RATE_MAX = 110;
const GEM_SPAWN_CHANCE = 0.20; // 20% chance to spawn a gem near an obstacle
const GEM_Y_OFFSET_MIN = -80;  // Relative to ground (negative is higher)
const GEM_Y_OFFSET_MAX = -40;

// --- Responsive Scaling ---
const BASE_CANVAS_HEIGHT = 600;
const PLAYER_BASE_W = 50;
const PLAYER_BASE_H = 60;
const OBSTACLE_BASE_H_OPTIONS = [40, 60, 90];
const OBSTACLE_BASE_W_OPTIONS = [30, 45, 60];
const GEM_BASE_SIZE = 25; // Gems are roughly square
const BASE_TEXT_SIZE_LARGE = 64;
const BASE_TEXT_SIZE_MEDIUM = 32;
const BASE_TEXT_SIZE_SMALL = 24;
const BASE_TEXT_SIZE_XSMALL = 16;

// --- Game Variables ---
let player;
let obstacles = [];
let gems = []; // Array for gems
let score = 0;
let gemScore = 0; // Score for collected gems
let currentObstacleSpeed = OBSTACLE_START_SPEED;
let gameState = 'START'; // START, PLAYING, GAME_OVER
let groundY;
let nextObstacleFrame;
let isJumpKeyDown = false; // Tracks if jump input is currently held

// Background layers
let bgLayers = [];

// Sound Variables
let jumpSound;
let gameOverSound;
let bgMusic;
let gemSound; // Sound for collecting gems

// --- Sizing Variables ---
let playerW, playerH;
let gemSize; // Calculated gem size
let groundOffset;
let textSizes = {};


// --- p5.js Preload Function ---
function preload() {
  // !!! IMPORTANT: REPLACE THESE PLACEHOLDER URLS !!!
  let jumpSoundPath = "SOUND_PLACEHOLDER_JUMP";
  let gameOverSoundPath = "SOUND_PLACEHOLDER_GAMEOVER";
  let bgMusicPath = "SOUND_PLACEHOLDER_MUSIC";
  let gemSoundPath = "SOUND_PLACEHOLDER_GEM"; // Add placeholder for gem sound

  // Jump Sound
  if (jumpSoundPath === "SOUND_PLACEHOLDER_JUMP") {
    console.warn("Jump sound URL not set.");
    jumpSound = { play: () => {}, setVolume: () => {} };
  } else {
    jumpSound = loadSound(jumpSoundPath);
  }
  // Game Over Sound
  if (gameOverSoundPath === "SOUND_PLACEHOLDER_GAMEOVER") {
    console.warn("Game Over sound URL not set.");
    gameOverSound = { play: () => {}, setVolume: () => {} };
  } else {
    gameOverSound = loadSound(gameOverSoundPath);
  }
  // Background Music
   if (bgMusicPath === "SOUND_PLACEHOLDER_MUSIC") {
    console.warn("Background music URL not set.");
    bgMusic = { loop: () => {}, stop: () => {}, setVolume: () => {}, isPlaying: () => false };
  } else {
    bgMusic = loadSound(bgMusicPath);
  }
  // Gem Collect Sound
  if (gemSoundPath === "SOUND_PLACEHOLDER_GEM") {
    console.warn("Gem collect sound URL not set.");
    gemSound = { play: () => {}, setVolume: () => {} };
  } else {
    gemSound = loadSound(gemSoundPath);
  }
}


// --- p5.js Setup Function ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth();
  rectMode(CORNER);
  textAlign(CENTER, CENTER);
  textFont('monospace');

  calculateResponsiveValues();
  initializeGame();

  // Set sound volumes
  jumpSound.setVolume(0.5);
  gameOverSound.setVolume(0.7);
  bgMusic.setVolume(0.3);
  gemSound.setVolume(0.6); // Set volume for gem sound
}

// --- Calculate Responsive Values ---
function calculateResponsiveValues() {
    groundOffset = height * (1 - GROUND_Y_PERCENT);
    groundY = height - groundOffset;

    let scaleFactor = height / BASE_CANVAS_HEIGHT;
    scaleFactor = constrain(scaleFactor, 0.7, 1.5);

    playerW = PLAYER_BASE_W * scaleFactor;
    playerH = PLAYER_BASE_H * scaleFactor;
    gemSize = GEM_BASE_SIZE * scaleFactor; // Calculate responsive gem size

    textSizes.large = BASE_TEXT_SIZE_LARGE * scaleFactor;
    textSizes.medium = BASE_TEXT_SIZE_MEDIUM * scaleFactor;
    textSizes.small = BASE_TEXT_SIZE_SMALL * scaleFactor;
    textSizes.xsmall = BASE_TEXT_SIZE_XSMALL * scaleFactor;

    bgLayers = [];
    bgLayers.push({ x: 0, y: 0, width: width, height: height, speed: 0.1, color: color(40, 10, 10) });
    bgLayers.push({ x: 0, y: height * 0.2, width: width, height: height * 0.6, speed: 0.2, type: 'distant_volcanoes', color1: color(60, 20, 20), color2: color(80, 30, 30, 200) });
    bgLayers.push({ x: 0, y: groundY - (150 * scaleFactor), width: width, height: (150 * scaleFactor), speed: 0.5, type: 'near_volcanoes', color1: color(120, 40, 0), color2: color(255, 100, 0, 150) });
    bgLayers.push({ x: 0, y: groundY - (30 * scaleFactor), width: width, height: (30 * scaleFactor), speed: currentObstacleSpeed * 0.8, type: 'ground_detail', color: color(80, 80, 80) });
    bgLayers.push({ x: 0, y: groundY, width: width, height: groundOffset, speed: 0, type: 'lava_ground', color1: color(255, 69, 0), color2: color(255, 140, 0) });

    if (player) {
        player.w = playerW;
        player.h = playerH;
        player.x = width * PLAYER_START_X_PERCENT;
        player.y = min(player.y, groundY - player.h);
    }
}

// --- Initialize Game Objects and State ---
function initializeGame() {
    score = 0;
    gemScore = 0; // Reset gem score
    obstacles = [];
    gems = []; // Reset gems array
    currentObstacleSpeed = OBSTACLE_START_SPEED;
    player = new Player();
    setNextObstacleFrame();
    isJumpKeyDown = false; // Reset jump key state
    gameState = 'START';
    if (bgMusic && typeof bgMusic.stop === 'function') {
        bgMusic.stop();
    }
}


// --- p5.js Draw Function (Game Loop) ---
function draw() {
  // 1. Update Game State Logic
  if (gameState === 'PLAYING') {
    score++;
    currentObstacleSpeed += OBSTACLE_ACCELERATION;

    player.update();
    handleObstaclesAndGems(); // Combined handler
    handleCollections();     // Check for gem collections

    // Check for game over (hitting obstacles)
    if (player.hits(obstacles)) {
      if (gameOverSound && typeof gameOverSound.play === 'function') {
           gameOverSound.play();
      }
      if (bgMusic && typeof bgMusic.stop === 'function'){
           bgMusic.stop();
      }
      gameState = 'GAME_OVER';
    }

    // Update dynamic background layer speeds
     bgLayers.find(layer => layer.type === 'ground_detail').speed = currentObstacleSpeed * 0.8;

  } else if (gameState === 'GAME_OVER') {
      // Game is frozen
  } else if (gameState === 'START') {
      // Music start moved to handleInput
  }

  // 2. Drawing
  background(50, 15, 15);
  drawBackground();

  if (gameState === 'START') {
    drawStartScreen();
  } else if (gameState === 'PLAYING') {
    drawGems();       // Draw gems first (might be behind player)
    player.show();
    drawObstacles();
    drawHUD();        // Draw HUD last (on top)
  } else if (gameState === 'GAME_OVER') {
    drawGems();
    player.show();
    drawObstacles();
    drawGameOverScreen(); // Draw Game Over screen on top
  }
}

// --- Input Handling ---
function handleInputPress() {
    // Ensure audio context is started by user gesture if needed
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume().then(() => {
            console.log("Audio Context resumed!");
            processInputPressState(); // Process input after context is ready
        }).catch(e => console.error("Error resuming audio context:", e));
    } else {
        processInputPressState(); // Audio context already running
    }
}

function processInputPressState() {
    if (gameState === 'PLAYING') {
        isJumpKeyDown = true; // Mark that jump input is active
        player.jump();        // Initiate the jump impulse
    } else if (gameState === 'START') {
        resetGame();
        gameState = 'PLAYING';
        if (bgMusic && !bgMusic.isPlaying() && typeof bgMusic.loop === 'function'){
            bgMusic.loop();
        }
    } else if (gameState === 'GAME_OVER') {
        resetGame();
        gameState = 'PLAYING';
        if (bgMusic && !bgMusic.isPlaying() && typeof bgMusic.loop === 'function'){
            bgMusic.loop();
        }
    }
}

function handleInputRelease() {
    isJumpKeyDown = false; // Mark that jump input is no longer active
}


// --- Event Listeners ---

function keyPressed() {
  if (key === ' ' || keyCode === UP_ARROW) {
     if (!isJumpKeyDown) { // Prevent rapid re-triggering if key is held
         handleInputPress();
     }
     return false; // Prevent default browser scroll
  }
  if (keyCode === ENTER || keyCode === RETURN) {
      if(gameState === 'START' || gameState === 'GAME_OVER') {
          handleInputPress(); // Use the same start/reset logic
      }
  }
}

function keyReleased() {
   if (key === ' ' || keyCode === UP_ARROW) {
       handleInputRelease();
   }
}

function mousePressed() {
    handleInputPress();
}

function mouseReleased() {
    handleInputRelease();
}

function touchStarted() {
    handleInputPress();
    return false; // Prevent default browser behavior
}

function touchEnded() {
    handleInputRelease();
     // Note: touchEnded might sometimes fire unexpectedly.
     // Consider adding a small delay or check if touch is truly lifted if issues arise.
     return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateResponsiveValues();
   if (gameState === 'PLAYING') {
       player.y = min(player.y, groundY - player.h);
   }
}


// --- Helper Functions ---

function resetGame() {
    if (bgMusic && typeof bgMusic.stop === 'function') {
        bgMusic.stop();
    }
    calculateResponsiveValues();
    initializeGame();
    // gameState is set by the input handler that triggers the reset
}

function setNextObstacleFrame() {
    let adjustedRateMin = OBSTACLE_SPAWN_RATE_MIN * (OBSTACLE_START_SPEED / currentObstacleSpeed);
    let adjustedRateMax = OBSTACLE_SPAWN_RATE_MAX * (OBSTACLE_START_SPEED / currentObstacleSpeed);
    nextObstacleFrame = frameCount + floor(random(adjustedRateMin, adjustedRateMax));
}

// Combined handler for obstacles and gems
function handleObstaclesAndGems() {
  // --- Spawning ---
  if (frameCount >= nextObstacleFrame) {
    // Always spawn an obstacle
    let newObstacle = new Obstacle();
    obstacles.push(newObstacle);

    // Chance to spawn a gem near the obstacle
    if (random(1) < GEM_SPAWN_CHANCE) {
        // Spawn gem slightly ahead of obstacle and higher up
        let gemX = newObstacle.x + newObstacle.w / 2 + random(20, 50);
        let gemYOffset = random(GEM_Y_OFFSET_MIN, GEM_Y_OFFSET_MAX) * (height/BASE_CANVAS_HEIGHT); // Scale offset
        let gemY = groundY + gemYOffset - gemSize; // Y is from top-left
        gems.push(new Gem(gemX, gemY));
    }

    setNextObstacleFrame(); // Set time for next obstacle (and potential gem)
  }

  // --- Update and Remove Obstacles ---
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    if (obstacles[i].isOffscreen()) {
      obstacles.splice(i, 1);
    }
  }

  // --- Update and Remove Gems ---
   for (let i = gems.length - 1; i >= 0; i--) {
    gems[i].update();
    if (gems[i].isOffscreen()) {
      gems.splice(i, 1);
    }
  }
}

// Handle player collecting gems
function handleCollections() {
    for (let i = gems.length - 1; i >= 0; i--) {
        if (player.collects(gems[i])) {
            gemScore++; // Increase gem score
             if (gemSound && typeof gemSound.play === 'function') {
                gemSound.play(); // Play gem collect sound
            }
            gems.splice(i, 1); // Remove the collected gem
        }
    }
}


function drawObstacles() {
  for (let obs of obstacles) {
    obs.show();
  }
}

function drawGems() {
  for (let gem of gems) {
    gem.show();
  }
}

function drawBackground() {
  push();
  noStroke();
  for (let i = 0; i < bgLayers.length; i++) {
    let layer = bgLayers[i];
    let speed = layer.speed;
    if (layer.type === 'ground_detail') {
        speed = currentObstacleSpeed * 0.8;
    }

    if (gameState === 'PLAYING') {
        layer.x -= speed;
    }

    if (layer.x <= -layer.width) {
      layer.x += layer.width;
    }

    fill(layer.color || layer.color1 || 0);

     // ... (drawing logic for different background layer types - unchanged) ...
     if (layer.type === 'distant_volcanoes') {
        fill(layer.color1);
        for(let xOffset = layer.x % 300; xOffset < width + 300; xOffset += 300) {
            beginShape();
            vertex(xOffset - 150, layer.y + layer.height); vertex(xOffset - 100, layer.y + layer.height * 0.3); vertex(xOffset - 50, layer.y + layer.height * 0.6); vertex(xOffset, layer.y + layer.height * 0.2); vertex(xOffset + 80, layer.y + layer.height * 0.7); vertex(xOffset + 150, layer.y + layer.height);
            endShape(CLOSE);
        }
         fill(layer.color2);
          for(let xOffset = layer.x % 300 + 80; xOffset < width + 300; xOffset += 300) {
            beginShape();
            vertex(xOffset - 150, layer.y + layer.height); vertex(xOffset - 100, layer.y + layer.height * 0.4); vertex(xOffset, layer.y + layer.height * 0.3); vertex(xOffset + 150, layer.y + layer.height);
            endShape(CLOSE);
        }
    } else if (layer.type === 'near_volcanoes') {
        fill(layer.color1);
         let volcanoBaseWidth = 400 * (layer.height / (150 * (height/BASE_CANVAS_HEIGHT)));
         volcanoBaseWidth = max(volcanoBaseWidth, 200);
        for(let xOffset = layer.x % volcanoBaseWidth; xOffset < width + volcanoBaseWidth; xOffset += volcanoBaseWidth) {
            triangle(xOffset - volcanoBaseWidth/2, layer.y + layer.height, xOffset, layer.y, xOffset + volcanoBaseWidth/2, layer.y + layer.height);
        }
        fill(layer.color2);
         for(let xOffset = layer.x % volcanoBaseWidth; xOffset < width + volcanoBaseWidth; xOffset += volcanoBaseWidth) {
             let glowTopWidth = volcanoBaseWidth * 0.25; let glowTopY = layer.y + layer.height * 0.4;
             triangle(xOffset - glowTopWidth/2, glowTopY, xOffset, layer.y, xOffset + glowTopWidth/2, glowTopY);
              ellipse(xOffset, layer.y, glowTopWidth*1.5, layer.height * 0.2);
         }
    } else if (layer.type === 'ground_detail') {
        fill(layer.color);
         for(let xOffset = layer.x % 40; xOffset < width + 40; xOffset += 40) {
             triangle(xOffset, layer.y + layer.height, xOffset + 5, layer.y, xOffset + 10, layer.y + layer.height);
             rect(xOffset + 15, layer.y + layer.height * 0.5, 8, layer.height * 0.5);
         }
    } else if (layer.type === 'lava_ground') {
         for(let x = 0; x < width; x+= 20) {
            let wave = sin(frameCount * 0.05 + x * 0.05) * 5 * (height/BASE_CANVAS_HEIGHT);
            fill(lerpColor(layer.color1, layer.color2, noise(frameCount * 0.01 + x * 0.01)));
            rect(x, layer.y + wave, 20, layer.height);
         }
    } else {
        rect(layer.x, layer.y, layer.width + 1, layer.height);
        rect(layer.x + layer.width, layer.y, layer.width + 1, layer.height);
    }
  }
  pop();

   stroke(255, 255, 0, 150);
   strokeWeight(max(1, 2 * (height/BASE_CANVAS_HEIGHT)));
   beginShape();
   let waveScale = 2 * (height/BASE_CANVAS_HEIGHT);
   for (let x = 0; x <= width; x+= 10) {
        let wave = sin(frameCount * 0.06 + x * 0.06) * waveScale;
        vertex(x, groundY + wave);
   }
   endShape();
}


function drawHUD() {
  // Score Display
  fill(255, 220, 0);
  stroke(0);
  strokeWeight(max(1, 3 * (height/BASE_CANVAS_HEIGHT)));
  textSize(textSizes.medium);
  textAlign(LEFT, TOP);
  text(`Score: ${floor(score / 10)}`, 20, 20);

  // Gem Score Display - Position it relative to the main score
  let gemTextX = 20;
  let gemTextY = 20 + textSizes.medium * 1.2; // Place below score
  fill(0, 200, 255); // Cyan color for gems
  text(`Gems: ${gemScore}`, gemTextX, gemTextY);


  // Controls Hint
  textSize(textSizes.xsmall);
  fill(255, 255, 255, 180);
  noStroke();
  textAlign(CENTER, TOP);
  text(`[HOLD SPACE / TAP] to Jump Higher`, width / 2, 20); // Updated hint
}

function drawStartScreen() {
  fill(0, 0, 0, 180);
  rect(0, 0, width, height);

  fill(255, 100, 0);
  stroke(0);
  strokeWeight(max(2, 4 * (height/BASE_CANVAS_HEIGHT)));
  textSize(textSizes.large);
  textAlign(CENTER, CENTER);
  text("HEATBLAST RUN", width / 2, height / 2 - (60 * (height/BASE_CANVAS_HEIGHT)));

  fill(255);
  noStroke();
  textSize(textSizes.small);
  text("Press [SPACE] / [TAP] to Start", width / 2, height / 2 + (30 * (height/BASE_CANVAS_HEIGHT)));
   textSize(textSizes.xsmall);
   text("(Hold for higher jump!)", width / 2, height / 2 + (70 * (height/BASE_CANVAS_HEIGHT))); // Jump hint
   text("(Tap/Click helps enable audio)", width / 2, height / 2 + (100 * (height/BASE_CANVAS_HEIGHT)));
}

function drawGameOverScreen() {
  fill(150, 0, 0, 190);
  rect(0, 0, width, height);

  fill(255, 50, 0);
  stroke(0);
   strokeWeight(max(2, 4 * (height/BASE_CANVAS_HEIGHT)));
  textSize(textSizes.large);
  textAlign(CENTER, CENTER);
  text("GAME OVER", width / 2, height / 2 - (80 * (height/BASE_CANVAS_HEIGHT))); // Adjusted spacing

  // Final Score
  fill(255, 220, 0); // Gold-ish
  textSize(textSizes.medium);
   strokeWeight(max(1, 3 * (height/BASE_CANVAS_HEIGHT)));
  text(`Final Score: ${floor(score / 10)}`, width / 2, height / 2 - (10 * (height/BASE_CANVAS_HEIGHT))); // Adjusted spacing

  // Final Gem Score
  fill(0, 200, 255); // Cyan
  text(`Gems Collected: ${gemScore}`, width / 2, height / 2 + (30 * (height/BASE_CANVAS_HEIGHT))); // Adjusted spacing

  // Restart Instructions
  fill(255);
  noStroke();
  textSize(textSizes.small);
  text("Press [ENTER] / [TAP] to Restart", width / 2, height / 2 + (80 * (height/BASE_CANVAS_HEIGHT))); // Adjusted spacing
}


// --- Player Class ---
class Player {
  constructor() {
    this.w = playerW;
    this.h = playerH;
    this.x = width * PLAYER_START_X_PERCENT;
    this.y = groundY - this.h;
    this.vy = 0;
    this.gravity = GRAVITY;
    this.jumpForce = JUMP_FORCE;
    this.isGrounded = true;
    this.jumpFrameCount = 0;
  }

  jump() {
    // Only allow jump initiation if grounded
    if (this.isGrounded) {
      this.vy = this.jumpForce; // Apply initial upward force
      this.isGrounded = false;
      this.jumpFrameCount = 10;
       if (jumpSound && typeof jumpSound.play === 'function') {
           jumpSound.play();
      }
    }
  }

  update() {
    this.vy += this.gravity;

    // --- Variable Jump Height Logic ---
    // If moving upwards AND the jump key is released, cut the jump short
    if (this.vy < -1 && !isJumpKeyDown) { // Check vy < -1 to avoid cutting at the very peak
        this.vy *= JUMP_CUT_VELOCITY_FACTOR; // Reduce upward velocity significantly
    }
    // --- End Variable Jump Height Logic ---

    this.y += this.vy;
    this.jumpFrameCount = max(0, this.jumpFrameCount - 1);

    // Ground collision
    if (this.y >= groundY - this.h) {
      this.y = groundY - this.h;
      this.vy = 0;
      this.isGrounded = true;
    }
  }

  hits(obstacles) {
    for (let obs of obstacles) {
      let playerRight = this.x + this.w;
      let playerBottom = this.y + this.h;
      let obsRight = obs.x + obs.w;
      let obsBottom = obs.y + obs.h;

      if (playerRight > obs.x && this.x < obsRight && playerBottom > obs.y && this.y < obsBottom) {
        return true;
      }
    }
    return false;
  }

  // Collision check specifically for gems
  collects(gem) {
      let playerRight = this.x + this.w;
      let playerBottom = this.y + this.h;
      let gemRight = gem.x + gem.w;
      let gemBottom = gem.y + gem.h;

      // Use AABB collision check
       if (playerRight > gem.x && this.x < gemRight && playerBottom > gem.y && this.y < gemBottom) {
        return true;
      }
      return false;
  }

  show() {
    push();
    translate(this.x, this.y);
    noStroke();

    // ... (Player drawing logic - unchanged) ...
     if (this.jumpFrameCount > 0 || !this.isGrounded) {
         fill(255, 200, 0, 180); rect(-5 * (this.w/PLAYER_BASE_W), this.h * 0.8, this.w + 10 * (this.w/PLAYER_BASE_W), this.h * 0.3 + 5 * (this.h/PLAYER_BASE_H));
         fill(255, 100, 0, 200); rect(0, this.h * 0.9, this.w, this.h * 0.2 + 5 * (this.h/PLAYER_BASE_H));
    }
    fill(20, 20, 20);
    if (this.isGrounded) {
        rect(this.w * 0.2, this.h * 0.7, this.w * 0.25, this.h * 0.3); rect(this.w * 0.55, this.h * 0.7, this.w * 0.25, this.h * 0.3);
    } else {
        rect(this.w * 0.3, this.h * 0.65, this.w * 0.2, this.h * 0.25); rect(this.w * 0.55, this.h * 0.65, this.w * 0.2, this.h * 0.25);
    }
    fill(200, 80, 0); rect(this.w * 0.1, this.h * 0.1, this.w * 0.8, this.h * 0.7);
    fill(255, 165, 0); rect(this.w * 0.2, this.h * 0.2, this.w * 0.6, this.h * 0.5); rect(this.w * 0.45, this.h * 0.1, this.w * 0.1, this.h * 0.7); rect(this.w * 0.1, this.h * 0.4, this.w * 0.8, this.h * 0.1);
    fill(180, 70, 0); rect(this.w * 0.3, 0, this.w * 0.4, this.h * 0.2);
     let symX = this.w * 0.4; let symY = this.h * 0.35; let symS = this.w * 0.2;
     fill(0); ellipse(symX + symS * 0.5, symY + symS*0.5, symS * 1.2, symS * 1.2);
     fill(255); ellipse(symX + symS * 0.5, symY + symS*0.5, symS, symS);
     fill(0, 180, 0); triangle(symX + symS * 0.2, symY + symS * 0.2, symX + symS * 0.8, symY + symS * 0.2, symX + symS * 0.5, symY + symS * 0.5); triangle(symX + symS * 0.2, symY + symS * 0.8, symX + symS * 0.8, symY + symS * 0.8, symX + symS * 0.5, symY + symS * 0.5);

    pop();
  }
}

// --- Obstacle Class ---
class Obstacle {
  constructor() {
    let scaleFactor = height / BASE_CANVAS_HEIGHT;
    scaleFactor = constrain(scaleFactor, 0.7, 1.5);
    let hOptions = OBSTACLE_BASE_H_OPTIONS.map(h => h * scaleFactor);
    let wOptions = OBSTACLE_BASE_W_OPTIONS.map(w => w * scaleFactor);
    this.h = random(hOptions);
    this.w = random(wOptions);
    this.x = width;
    this.y = groundY - this.h;
    this.color1 = color(80, 50, 120);
    this.color2 = color(120, 80, 180);
    this.shapeType = random(['jagged', 'crystal']);
  }

  update() {
    this.x -= currentObstacleSpeed;
  }

  isOffscreen() {
    return this.x + this.w < 0;
  }

  show() {
    push();
    translate(this.x, this.y);
    noStroke();
    // ... (Obstacle drawing logic - unchanged) ...
     if (this.shapeType === 'jagged') {
         fill(this.color1);
         beginShape(); vertex(0, this.h); vertex(this.w * 0.2, this.h * 0.5); vertex(this.w * 0.1, this.h * 0.4); vertex(this.w * 0.5, 0); vertex(this.w * 0.8, this.h * 0.6); vertex(this.w * 0.7, this.h * 0.7); vertex(this.w, this.h); endShape(CLOSE);
         fill(this.color2); triangle(this.w * 0.3, this.h * 0.6, this.w * 0.5, 0, this.w * 0.6, this.h*0.5); rect(this.w * 0.1, this.h*0.8, this.w * 0.2, this.h * 0.1);
    } else {
        fill(this.color2);
        beginShape(); vertex(this.w * 0.5, 0); vertex(this.w, this.h * 0.8); vertex(this.w * 0.7, this.h); vertex(this.w * 0.3, this.h); vertex(0, this.h * 0.8); endShape(CLOSE);
        fill(this.color1); triangle(this.w * 0.3, this.h, this.w * 0.5, 0, 0, this.h * 0.8); triangle(this.w * 0.7, this.h, this.w * 0.5, 0, this.w, this.h* 0.8);
    }
    pop();
  }
}

// --- Gem Class ---
class Gem {
    constructor(x, y) {
        this.w = gemSize; // Use calculated responsive size
        this.h = gemSize;
        this.x = x;
        this.y = y;
        this.color1 = color(0, 220, 255); // Bright Cyan
        this.color2 = color(200, 255, 255); // White/Light Cyan highlight
        this.angle = random(TWO_PI); // Initial angle for subtle rotation/shine effect
        this.rotationSpeed = random(0.02, 0.05);
    }

    update() {
        this.x -= currentObstacleSpeed; // Move with the game world
        this.angle += this.rotationSpeed; // Rotate slowly
    }

    isOffscreen() {
        return this.x + this.w < 0;
    }

    show() {
        push();
        translate(this.x + this.w / 2, this.y + this.h / 2); // Translate to center for rotation
        rotate(this.angle);
        rectMode(CENTER); // Draw rects from center
        noStroke();

        // Simple Diamond Shape
        fill(this.color1);
        // Use quad or triangles for diamond shape relative to w/h
        beginShape();
        vertex(0, -this.h * 0.5);       // Top point
        vertex(this.w * 0.5, 0);        // Right point
        vertex(0, this.h * 0.5);        // Bottom point
        vertex(-this.w * 0.5, 0);       // Left point
        endShape(CLOSE);

        // Highlight/Facet
        fill(this.color2);
         triangle(0, -this.h * 0.5, this.w * 0.3, 0, -this.w * 0.3, 0); // Top facet


        rectMode(CORNER); // Reset rectMode
        pop();
    }
}