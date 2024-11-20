"use client";
import React from "react";

function MainComponent() {
  const [gameStarted, setGameStarted] = React.useState(false);
  const canvasRef = React.useRef(null);
  const gameInstanceRef = React.useRef(null);

  React.useEffect(() => {
    if (gameStarted) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      document.body.style.touchAction = "none";
      document.documentElement.style.userSelect = "none";
      document.documentElement.style.webkitUserSelect = "none";
      document.documentElement.style.webkitTouchCallout = "none";
      document.documentElement.style.msUserSelect = "none";
      document.documentElement.style.webkitTapHighlightColor = "transparent";
    }

    if (!gameStarted || !canvasRef.current) return;

    const loadScripts = async () => {
      if (typeof THREE === "undefined") {
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      if (typeof nipplejs === "undefined") {
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/nipplejs/0.10.1/nipplejs.min.js";
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      class Game {
        constructor(canvas) {
          this.audioContext = new (window.AudioContext ||
            window.webkitAudioContext)();

          document.addEventListener(
            "click",
            () => {
              this.audioContext.resume();
            },
            { once: true }
          );

          this.setupSounds();

          this.scene = new THREE.Scene();
          this.scene.background = new THREE.Color(0x1a0f1f);
          this.scene.fog = new THREE.Fog(0x1a0f1f, 1, 20);

          this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
          );
          this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
          this.renderer.setSize(window.innerWidth, window.innerHeight);
          this.renderer.setPixelRatio(window.devicePixelRatio);

          this.maze = [];
          this.mazeSize = 22;
          this.wallSize = 2;
          this.walls = [];
          this.enemies = [];
          this.bullets = [];
          this.dots = [];
          this.score = 0;
          this.isInitialized = false;
          this.speed = 0.1;
          this.bulletSpeed = 0.5;
          this.playerPosition = new THREE.Vector3(0, 1, 0);
          this.playerVelocity = new THREE.Vector3();
          this.moveForward = false;
          this.moveBackward = false;
          this.moveLeft = false;
          this.moveRight = false;
          this.rotationSpeed = 0.02;
          this.mouseX = 0;
          this.lastX = 0;
          this.lastTouchX = 0;
          this.isDragging = false;
          this.isTouchDragging = false;
          this.isMobile =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
              navigator.userAgent
            );

          this.minimapCanvas = document.createElement("canvas");
          this.minimapCanvas.width = 150;
          this.minimapCanvas.height = 150;
          this.minimapCanvas.style.position = "absolute";
          this.minimapCanvas.style.top = "20px";
          this.minimapCanvas.style.right = "20px";
          this.minimapCanvas.style.border = "2px solid #ff6600";
          this.minimapCanvas.style.backgroundColor = "rgba(26, 15, 31, 0.7)";
          document.body.appendChild(this.minimapCanvas);
          this.minimapCtx = this.minimapCanvas.getContext("2d");

          this.enemySpeed = 0.05;
          this.enemyCount = 15;

          this.init();
          this.setupControls();
          this.spawnEnemies();
          this.spawnDots();
          this.animate();

          if (this.isMobile) {
            this.setupMobileControls();
          }
        }

        setupSounds() {
          const createOscillator = (frequency, type = "sine") => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(
              frequency,
              this.audioContext.currentTime
            );
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            return { oscillator, gainNode };
          };

          this.sounds = {
            dot: {
              play: () => {
                const { oscillator, gainNode } = createOscillator(440);
                gainNode.gain.setValueAtTime(
                  0.1,
                  this.audioContext.currentTime
                );
                gainNode.gain.exponentialRampToValueAtTime(
                  0.01,
                  this.audioContext.currentTime + 0.1
                );
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
              },
            },
            shoot: {
              play: () => {
                const { oscillator, gainNode } = createOscillator(
                  220,
                  "square"
                );
                gainNode.gain.setValueAtTime(
                  0.1,
                  this.audioContext.currentTime
                );
                gainNode.gain.exponentialRampToValueAtTime(
                  0.01,
                  this.audioContext.currentTime + 0.2
                );
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
              },
            },
            enemyHit: {
              play: () => {
                const { oscillator, gainNode } = createOscillator(
                  110,
                  "sawtooth"
                );
                gainNode.gain.setValueAtTime(
                  0.1,
                  this.audioContext.currentTime
                );
                gainNode.gain.exponentialRampToValueAtTime(
                  0.01,
                  this.audioContext.currentTime + 0.3
                );
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.3);
              },
            },
          };
        }

        setupMobileControls() {
          const joystickContainer = document.createElement("div");
          joystickContainer.style.cssText = `
            position: fixed;
            bottom: 50px;
            left: 50px;
            width: 120px;
            height: 120px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            pointer-events: none;
            touch-action: none;
            -webkit-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
          `;
          document.body.appendChild(joystickContainer);

          const joystickInner = document.createElement("div");
          joystickInner.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: auto;
          `;
          joystickContainer.appendChild(joystickInner);

          const fireButton = document.createElement("button");
          fireButton.style.cssText = `
            position: fixed;
            bottom: 50px;
            right: 50px;
            width: 60px;
            height: 60px;
            background: rgba(255, 102, 0, 0.5);
            border: 2px solid #ff6600;
            border-radius: 50%;
            color: white;
            font-size: 24px;
            z-index: 1000;
            pointer-events: auto;
            touch-action: none;
            -webkit-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
          `;
          fireButton.innerHTML = "🔥";
          fireButton.addEventListener(
            "touchstart",
            (e) => {
              e.preventDefault();
              e.stopPropagation();
              this.fireBullet();
            },
            { passive: false }
          );
          document.body.appendChild(fireButton);

          const options = {
            zone: joystickInner,
            mode: "static",
            position: { left: "50%", top: "50%" },
            color: "#ff6600",
            size: 120,
          };
          const joystick = nipplejs.create(options);
          let lastDirection = { x: 0, y: 0 };

          joystick.on("move", (evt, data) => {
            const forward = -data.vector.y;
            const right = data.vector.x;

            this.moveForward = forward < -0.3;
            this.moveBackward = forward > 0.3;
            this.moveLeft = right < -0.3;
            this.moveRight = right > 0.3;

            if (Math.abs(right) > 0.3) {
              this.camera.rotation.y -= right * this.rotationSpeed;
            }

            lastDirection = { x: right, y: forward };
          });

          joystick.on("end", () => {
            this.moveForward = false;
            this.moveBackward = false;
            this.moveLeft = false;
            this.moveRight = false;
            lastDirection = { x: 0, y: 0 };
          });

          document.addEventListener(
            "touchstart",
            (event) => {
              if (
                !event.target.closest(".joystick") &&
                !event.target.closest("button")
              ) {
                event.preventDefault();
                this.isTouchDragging = true;
                this.lastTouchX = event.touches[0].clientX;
              }
            },
            { passive: false }
          );

          document.addEventListener(
            "touchmove",
            (event) => {
              if (this.isTouchDragging) {
                event.preventDefault();
                const deltaX = event.touches[0].clientX - this.lastTouchX;
                this.camera.rotation.y -= deltaX * this.rotationSpeed * 0.5;
                this.lastTouchX = event.touches[0].clientX;
              }
            },
            { passive: false }
          );

          document.addEventListener(
            "touchend",
            (event) => {
              if (this.isTouchDragging) {
                event.preventDefault();
                this.isTouchDragging = false;
              }
            },
            { passive: false }
          );

          joystickContainer.classList.add("joystick");

          this.mobileCleanup = () => {
            joystick.destroy();
            document.body.removeChild(joystickContainer);
            document.body.removeChild(fireButton);
          };
        }

        spawnDots() {
          const treats = ["🍬", "🍭", "🍫", "🍪", "🧁", "🎃"];
          for (let y = 0; y < this.mazeSize; y++) {
            for (let x = 0; x < this.mazeSize; x++) {
              if (this.maze[y][x] === 0) {
                const dotCanvas = document.createElement("canvas");
                dotCanvas.width = 32;
                dotCanvas.height = 32;
                const dotCtx = dotCanvas.getContext("2d");
                dotCtx.font = "24px Arial";
                dotCtx.textAlign = "center";
                dotCtx.textBaseline = "middle";
                const treat = treats[Math.floor(Math.random() * treats.length)];
                dotCtx.fillText(treat, 16, 16);
                const dotTexture = new THREE.CanvasTexture(dotCanvas);
                const dotMaterial = new THREE.SpriteMaterial({
                  map: dotTexture,
                  transparent: true,
                  opacity: 0.8,
                });
                const dot = new THREE.Sprite(dotMaterial);
                dot.scale.set(0.5, 0.5, 1);
                dot.position.set(
                  (x - this.mazeSize / 2) * this.wallSize,
                  0.5,
                  (y - this.mazeSize / 2) * this.wallSize
                );
                this.dots.push(dot);
                this.scene.add(dot);
              }
            }
          }
        }

        checkDotCollection() {
          const playerPosition = this.camera.position;
          for (let i = this.dots.length - 1; i >= 0; i--) {
            const dot = this.dots[i];
            const dx = playerPosition.x - dot.position.x;
            const dz = playerPosition.z - dot.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < 0.5) {
              this.scene.remove(dot);
              this.dots.splice(i, 1);
              this.score += 5;
              this.scoreElement.innerHTML = `Score: ${this.score}`;
              this.sounds.dot.play();
            }
          }
        }

        generateMaze() {
          this.maze = Array(this.mazeSize)
            .fill()
            .map(() => Array(this.mazeSize).fill(1));

          const stack = [];
          const startX = 1;
          const startY = 1;

          this.maze[startY][startX] = 0;
          stack.push([startX, startY]);

          const directions = [
            [0, 2],
            [2, 0],
            [0, -2],
            [-2, 0],
          ];

          while (stack.length > 0) {
            const [currentX, currentY] = stack[stack.length - 1];
            const availableDirections = directions.filter(([dx, dy]) => {
              const newX = currentX + dx;
              const newY = currentY + dy;
              return (
                newX > 0 &&
                newX < this.mazeSize - 1 &&
                newY > 0 &&
                newY < this.mazeSize - 1 &&
                this.maze[newY][newX] === 1
              );
            });

            if (availableDirections.length === 0) {
              stack.pop();
              continue;
            }

            const [dx, dy] =
              availableDirections[
                Math.floor(Math.random() * availableDirections.length)
              ];
            const newX = currentX + dx;
            const newY = currentY + dy;
            this.maze[currentY + dy / 2][currentX + dx / 2] = 0;
            this.maze[newY][newX] = 0;
            stack.push([newX, newY]);
          }
        }

        spawnEnemies() {
          const monsters = ["👻", "🧟", "🧛", "🦇", "💀", "🕷️"];
          const availableSpaces = [];
          for (let y = 0; y < this.mazeSize; y++) {
            for (let x = 0; x < this.mazeSize; x++) {
              if (this.maze[y][x] === 0) {
                availableSpaces.push([x, y]);
              }
            }
          }

          for (
            let i = 0;
            i < Math.min(this.enemyCount, availableSpaces.length);
            i++
          ) {
            const enemyCanvas = document.createElement("canvas");
            enemyCanvas.width = 64;
            enemyCanvas.height = 64;
            const enemyCtx = enemyCanvas.getContext("2d");
            enemyCtx.font = "48px Arial";
            enemyCtx.textAlign = "center";
            enemyCtx.textBaseline = "middle";
            const monster =
              monsters[Math.floor(Math.random() * monsters.length)];
            enemyCtx.fillText(monster, 32, 32);
            const enemyTexture = new THREE.CanvasTexture(enemyCanvas);
            const enemyMaterial = new THREE.SpriteMaterial({
              map: enemyTexture,
              transparent: true,
              opacity: 0.8,
            });
            const enemy = new THREE.Sprite(enemyMaterial);
            enemy.scale.set(1, 1, 1);
            const randomIndex = Math.floor(
              Math.random() * availableSpaces.length
            );
            const [x, y] = availableSpaces[randomIndex];
            availableSpaces.splice(randomIndex, 1);

            enemy.position.set(
              (x - this.mazeSize / 2) * this.wallSize,
              1,
              (y - this.mazeSize / 2) * this.wallSize
            );

            this.enemies.push(enemy);
            this.scene.add(enemy);
          }
        }

        fireBullet() {
          const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
          const bulletMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00,
          });
          const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

          bullet.position.copy(this.camera.position);

          const direction = new THREE.Vector3(0, 0, -1);
          direction.applyQuaternion(this.camera.quaternion);
          bullet.velocity = direction.multiplyScalar(this.bulletSpeed);

          this.bullets.push(bullet);
          this.scene.add(bullet);
          this.sounds.shoot.play();
        }

        setupControls() {
          document.addEventListener("keydown", (event) => {
            switch (event.key) {
              case "w":
                this.moveForward = true;
                break;
              case "s":
                this.moveBackward = true;
                break;
              case "a":
                this.moveLeft = true;
                break;
              case "d":
                this.moveRight = true;
                break;
              case " ":
                this.fireBullet();
                break;
            }
          });

          document.addEventListener("keyup", (event) => {
            switch (event.key) {
              case "w":
                this.moveForward = false;
                break;
              case "s":
                this.moveBackward = false;
                break;
              case "a":
                this.moveLeft = false;
                break;
              case "d":
                this.moveRight = false;
                break;
            }
          });

          document.addEventListener("mousedown", (event) => {
            this.isDragging = true;
            this.lastX = event.clientX;
          });

          document.addEventListener("mouseup", () => {
            this.isDragging = false;
          });

          document.addEventListener("mousemove", (event) => {
            if (this.isDragging) {
              const deltaX = event.clientX - this.lastX;
              this.camera.rotation.y -= deltaX * this.rotationSpeed;
              this.lastX = event.clientX;
            }
          });
        }

        init() {
          if (!this.isInitialized) {
            this.isInitialized = true;
            this.camera.position.set(0, 1, 0);
            this.camera.lookAt(0, 1, -1);

            const scoreElement = document.createElement("div");
            scoreElement.style.position = "absolute";
            scoreElement.style.top = "20px";
            scoreElement.style.left = "20px";
            scoreElement.style.color = "#ff6600";
            scoreElement.style.fontSize = "24px";
            scoreElement.innerHTML = `Score: ${this.score}`;
            document.body.appendChild(scoreElement);
            this.scoreElement = scoreElement;

            const ambientLight = new THREE.AmbientLight(0xff6600, 0.5);
            this.scene.add(ambientLight);

            const pointLight = new THREE.PointLight(0xff6600, 1);
            pointLight.position.set(0, 2, 0);
            this.scene.add(pointLight);

            const groundGeometry = new THREE.PlaneGeometry(50, 50);
            const groundMaterial = new THREE.MeshPhongMaterial({
              color: 0x331111,
              side: THREE.DoubleSide,
            });
            const ground = new THREE.Mesh(groundGeometry, groundMaterial);
            ground.rotation.x = Math.PI / 2;
            ground.position.y = 0;
            this.scene.add(ground);

            this.generateMaze();

            for (let y = 0; y < this.mazeSize; y++) {
              for (let x = 0; x < this.mazeSize; x++) {
                if (this.maze[y][x] === 1) {
                  const wallGeometry = new THREE.BoxGeometry(
                    this.wallSize,
                    this.wallSize * 2,
                    this.wallSize
                  );
                  const wallMaterial = new THREE.MeshPhongMaterial({
                    color: 0x660033,
                    transparent: true,
                    opacity: 0.9,
                    shininess: 30,
                    emissive: 0x330011,
                    emissiveIntensity: 0.2,
                  });
                  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                  wall.position.set(
                    (x - this.mazeSize / 2) * this.wallSize,
                    1,
                    (y - this.mazeSize / 2) * this.wallSize
                  );
                  this.walls.push(wall);
                  this.scene.add(wall);
                }
              }
            }
          }
        }

        checkCollision(position) {
          const playerRadius = 0.5;
          for (const wall of this.walls) {
            const dx = position.x - wall.position.x;
            const dz = position.z - wall.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < this.wallSize / 2 + playerRadius) {
              return true;
            }
          }
          return false;
        }

        updateBullets() {
          for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.position.add(bullet.velocity);

            if (this.checkCollision(bullet.position)) {
              this.scene.remove(bullet);
              this.bullets.splice(i, 1);
              continue;
            }

            for (let j = this.enemies.length - 1; j >= 0; j--) {
              const enemy = this.enemies[j];
              const dx = bullet.position.x - enemy.position.x;
              const dz = bullet.position.z - enemy.position.z;
              const distance = Math.sqrt(dx * dx + dz * dz);

              if (distance < 0.5) {
                this.scene.remove(enemy);
                this.enemies.splice(j, 1);
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
                this.score += 100;
                this.scoreElement.innerHTML = `Score: ${this.score}`;
                this.sounds.enemyHit.play();
                break;
              }
            }
          }
        }

        updatePlayer() {
          const direction = new THREE.Vector3();

          if (this.moveForward) direction.z -= 1;
          if (this.moveBackward) direction.z += 1;
          if (this.moveLeft) direction.x -= 1;
          if (this.moveRight) direction.x += 1;

          if (direction.length() > 0) {
            direction.normalize();
            direction.applyQuaternion(this.camera.quaternion);
            direction.y = 0;

            const moveVector = direction.multiplyScalar(this.speed);
            const newPosition = this.camera.position.clone().add(moveVector);

            if (!this.checkCollision(newPosition)) {
              this.camera.position.copy(newPosition);
              this.checkDotCollection();
            }
          }
        }

        updateMinimap() {
          const cellSize = this.minimapCanvas.width / this.mazeSize;

          // Clear minimap
          this.minimapCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
          this.minimapCtx.fillRect(
            0,
            0,
            this.minimapCanvas.width,
            this.minimapCanvas.height
          );

          // Draw maze walls
          for (let y = 0; y < this.mazeSize; y++) {
            for (let x = 0; x < this.mazeSize; x++) {
              if (this.maze[y][x] === 1) {
                this.minimapCtx.fillStyle = "#4422bb";
                this.minimapCtx.fillRect(
                  x * cellSize,
                  y * cellSize,
                  cellSize,
                  cellSize
                );
              }
            }
          }

          // Draw enemies
          this.enemies.forEach((enemy) => {
            const x =
              ((enemy.position.x + (this.mazeSize * this.wallSize) / 2) /
                (this.mazeSize * this.wallSize)) *
              this.minimapCanvas.width;
            const y =
              ((enemy.position.z + (this.mazeSize * this.wallSize) / 2) /
                (this.mazeSize * this.wallSize)) *
              this.minimapCanvas.height;
            this.minimapCtx.fillStyle = "red";
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(x, y, 3, 0, Math.PI * 2);
            this.minimapCtx.fill();
          });

          // Draw dots
          this.dots.forEach((dot) => {
            const x =
              ((dot.position.x + (this.mazeSize * this.wallSize) / 2) /
                (this.mazeSize * this.wallSize)) *
              this.minimapCanvas.width;
            const y =
              ((dot.position.z + (this.mazeSize * this.wallSize) / 2) /
                (this.mazeSize * this.wallSize)) *
              this.minimapCanvas.height;
            this.minimapCtx.fillStyle = "white";
            this.minimapCtx.beginPath();
            this.minimapCtx.arc(x, y, 1, 0, Math.PI * 2);
            this.minimapCtx.fill();
          });

          // Draw player
          const playerX =
            ((this.camera.position.x + (this.mazeSize * this.wallSize) / 2) /
              (this.mazeSize * this.wallSize)) *
            this.minimapCanvas.width;
          const playerY =
            ((this.camera.position.z + (this.mazeSize * this.wallSize) / 2) /
              (this.mazeSize * this.wallSize)) *
            this.minimapCanvas.height;

          // Draw player direction
          const dirX = playerX + Math.sin(this.camera.rotation.y) * 10;
          const dirY = playerY + Math.cos(this.camera.rotation.y) * 10;

          // Draw player position
          this.minimapCtx.fillStyle = "yellow";
          this.minimapCtx.beginPath();
          this.minimapCtx.arc(playerX, playerY, 4, 0, Math.PI * 2);
          this.minimapCtx.fill();

          // Draw direction line
          this.minimapCtx.strokeStyle = "yellow";
          this.minimapCtx.beginPath();
          this.minimapCtx.moveTo(playerX, playerY);
          this.minimapCtx.lineTo(dirX, dirY);
          this.minimapCtx.stroke();
        }

        updateEnemies() {
          this.enemies.forEach((enemy) => {
            const directionToPlayer = new THREE.Vector3();
            directionToPlayer.subVectors(this.camera.position, enemy.position);
            directionToPlayer.normalize();

            const newPosition = enemy.position.clone();
            newPosition.add(directionToPlayer.multiplyScalar(this.enemySpeed));

            if (!this.checkCollision(newPosition)) {
              enemy.position.copy(newPosition);
            } else {
              let attempts = 0;
              let foundValidMove = false;

              while (attempts < 8 && !foundValidMove) {
                const angle = (Math.PI / 4) * attempts;
                const alternateDirection = new THREE.Vector3(
                  Math.cos(angle),
                  0,
                  Math.sin(angle)
                );
                const alternatePosition = enemy.position.clone();
                alternatePosition.add(
                  alternateDirection.multiplyScalar(this.enemySpeed)
                );

                if (!this.checkCollision(alternatePosition)) {
                  enemy.position.copy(alternatePosition);
                  foundValidMove = true;
                }

                attempts++;
              }
            }
          });
        }

        animate = () => {
          requestAnimationFrame(this.animate);
          this.updatePlayer();
          this.updateBullets();
          this.updateEnemies();
          this.updateMinimap();
          this.renderer.render(this.scene, this.camera);
        };
      }

      const game = new Game(canvasRef.current);
      gameInstanceRef.current = game;
    };

    loadScripts();

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.isInitialized = false;
        if (gameInstanceRef.current.scoreElement) {
          document.body.removeChild(gameInstanceRef.current.scoreElement);
        }
        if (gameInstanceRef.current.minimapCanvas) {
          document.body.removeChild(gameInstanceRef.current.minimapCanvas);
        }
        if (gameInstanceRef.current.mobileCleanup) {
          gameInstanceRef.current.mobileCleanup();
        }
        if (gameInstanceRef.current.audioContext) {
          gameInstanceRef.current.audioContext.close();
        }
      }
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
      document.body.style.touchAction = "";
      document.documentElement.style.userSelect = "";
      document.documentElement.style.webkitUserSelect = "";
      document.documentElement.style.webkitTouchCallout = "";
      document.documentElement.style.msUserSelect = "";
      document.documentElement.style.webkitTapHighlightColor = "";
    };
  }, [gameStarted]);

  return (
    <div className="relative w-full h-screen bg-[#1a0f1f] touch-none select-none">
      {!gameStarted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          <h1 className="text-4xl font-bold text-[#ff6600] mb-8 select-none">
            🎃 Spooky Maze Battle 👻
          </h1>
          <div className="text-[#ff6600] mb-8 text-center select-none">
            {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
              navigator.userAgent
            ) ? (
              <div>
                <p className="mb-2">操作方法:</p>
                <p>ジョイスティック - 移動</p>
                <p>画面をタップ＆ドラッグ - 視点操作</p>
                <p>発射ボタン - 弾を撃つ</p>
              </div>
            ) : (
              <div>
                <p className="mb-2">操作方法:</p>
                <p>WASD - 移動</p>
                <p>マウスドラッグ - 視点操作</p>
                <p>スペース/クリック - 弾を撃つ</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setGameStarted(true)}
            className="px-6 py-3 text-lg font-semibold text-white bg-[#ff6600] rounded hover:bg-[#ff8533] select-none"
          >
            ゲームを始める
          </button>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none select-none"
        />
      )}
    </div>
  );
}

export default MainComponent;