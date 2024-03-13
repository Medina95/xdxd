import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

export class MainScene extends Phaser.Scene {
    keys!: any;
    solidos!: any;
    others!: any;
    private otherSprites: { [playerId: string]: Phaser.Physics.Matter.Sprite } = {};
    private player!: Phaser.Physics.Matter.Sprite;
    private isKnockedDown: boolean = false;
    private isAttacking: boolean = false;
    private lastDirection: string = "down";
    private playerVelocity = new Phaser.Math.Vector2();
    private playerId!: string;
    private socket: Socket;

    private startx: number = 370;
    private starty: number = 300;


    constructor() {
        super({ key: 'MainScene' });
        this.socket = io('http://localhost:2525/');
        this.socket.on('connect', () => {
            if (this.socket.id) {
                this.playerId = this.socket.id; 
                console.log('Conectado al servidor, ID del jugador:', this.playerId);      
                this.socket.on('initialCoordinates', ({ x, y }) => {
                    this.startx = x;
                    this.starty = y;
                });        
            } 
        });
    }

    preload() {
        this.load.spritesheet("player", "assets/characters/player.png", {
            frameWidth: 48,
            frameHeight: 48
        });
        this.load.tilemapTiledJSON('lobby', 'assets/backgrounds/mapa.json');
        this.load.image('space', 'assets/backgrounds/spaceShip.png');
    }

    create() {
        const { width, height } = this.sys.game.canvas;
        this.create_mapa(width, height, 'lobby', 'spaceShip', 'space');
        this.create_animation();
        this.create_player(width, height, this.startx, this.starty, 'player');      

        this.socket.on('playerDisconnected', (playerId: string) => {
            console.log(`Jugador desconectado: ${playerId}`);
            const disconnectedPlayerSprite = this.otherSprites[playerId];
            if (disconnectedPlayerSprite) {
                disconnectedPlayerSprite.destroy(); 
                delete this.otherSprites[playerId]; 
            }
        });
        

        this.socket.on('updatePlayers', (data) => {
            data.forEach((player: { id: string, posx: number, posy: number, velocityx: number, velocityy: number, animation: string, key: string }) => {
                if (player.id !== this.playerId) { // FUNDAMENTAL
                    const existingSprite = this.otherSprites[player.id]; // FUNDAMENTAL
                    if (existingSprite && existingSprite != this.player) {
                        existingSprite.setVelocity(player.velocityx, player.velocityy);
                        if (player.animation) {
                            if(player.key === undefined || player.key === 'dead'){
                                existingSprite.anims.play('laying');
                                existingSprite.anims.stopAfterRepeat(0);
                                return;
                            } else if (player.key === 'move_x' && player.velocityx < 0) {
                                existingSprite.setFlipX(true);
                                existingSprite.anims.play(player.animation, true);
                            } else if(player.key === 'move_x' && player.velocityx > 0){
                                existingSprite.anims.play(player.animation, true);
                                existingSprite.setFlipX(false);
                            } else{
                                existingSprite.anims.play(player.animation, true);
                            }
                        }
                    } else {
                        if(player.id != null){
                            const newSprite = this.matter.add.sprite(player.posx, player.posy, 'player');
                            newSprite.setDisplaySize(70, 90);
                            newSprite.setRectangle(20, 35);
                            newSprite.setOrigin(0.5, 0.70);
                            newSprite.setFixedRotation();
                            this.otherSprites[player.id] = newSprite;  // jugadores remotos 
                            if (player.animation) {
                                if(player.key === undefined || player.key === 'dead'){
                                    existingSprite.setStatic(true)
                                    existingSprite.anims.play('laying');
                                    existingSprite.anims.stopAfterRepeat(0);
                                    return;
                                } else if (player.key === 'move_x' && player.velocityx < 0) {
                                    existingSprite.setFlipX(true);
                                    existingSprite.anims.play(player.animation, true);
                                } else if (player.key === 'move_x' && player.velocityx > 0){
                                    existingSprite.anims.play(player.animation, true);
                                    existingSprite.setFlipX(false);
                                } else{
                                    existingSprite.anims.play(player.animation, true);
                                }
                            }
                        }
                    }
                }
            });
        });

    }

    create_mapa(width: number, height: number, key: string, tileImage: string, tileSet: string) {
        const mapa = this.make.tilemap({ key: key });
        const spaceShip = mapa.addTilesetImage(tileImage, tileSet);
        if (spaceShip !== null) {
            mapa.createLayer('negro',spaceShip);
            const subcapa = mapa.createLayer('subcapa', spaceShip);
            const solidos = mapa.createLayer('solidos', spaceShip);
            if (solidos) {
                solidos.setCollisionByProperty({ pared: true });
                this.matter.world.setBounds(0, 0, width, height);
                this.matter.world.convertTilemapLayer(solidos);
            }
            if (subcapa) {
                subcapa.setCollisionByProperty({ pared: true });
                this.matter.world.setBounds(0, 0, width, height);
                this.matter.world.convertTilemapLayer(subcapa);
            }
        }
    }

    create_player(width: number, height: number, position_x: number, position_y: number, spray: string) {
        const newPositionX = position_x + Object.keys(this.otherSprites).length * 30;
        console.log(newPositionX);
        
        this.player = this.matter.add.sprite(newPositionX, position_y, spray);
        this.player.setDisplaySize(70, 90);
        this.player.setRectangle(20, 35);
        this.player.setOrigin(0.5, 0.70);
        this.player.setFixedRotation();
        this.cameras.main.setBounds(0, 0, width, height);
        this.cameras.main.startFollow(this.player);
        this.cameras.main.zoomTo(2.5);

        if (this.input && this.input.keyboard) {
            this.keys = this.input.keyboard.addKeys({
                'up': Phaser.Input.Keyboard.KeyCodes.W,
                'down': Phaser.Input.Keyboard.KeyCodes.S,
                'left': Phaser.Input.Keyboard.KeyCodes.A,
                'right': Phaser.Input.Keyboard.KeyCodes.D,
                'space': Phaser.Input.Keyboard.KeyCodes.SPACE,
                's1': Phaser.Input.Keyboard.KeyCodes.ONE
            });
        }
    }

    create_animation() {
        this.anims.create({
            key: 'attack_down',
            frames: this.anims.generateFrameNumbers('player', { start: 36, end: 39 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'attack_right',
            frames: this.anims.generateFrameNumbers('player', { start: 42, end: 45 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'attack_left',
            frames: this.anims.generateFrameNumbers('player', { start: 42, end: 45 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'attack_up',
            frames: this.anims.generateFrameNumbers('player', { start: 48, end: 51 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'move_x',
            frames: this.anims.generateFrameNumbers('player', { start: 24, end: 29 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'up',
            frames: this.anims.generateFrameNumbers('player', { start: 30, end: 35 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'down',
            frames: this.anims.generateFrameNumbers('player', { start: 18, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'stand_down',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 5 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'stand_up',
            frames: this.anims.generateFrameNumbers('player', { start: 12, end: 17 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'stand_left',
            frames: this.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'stand_right',
            frames: this.anims.generateFrameNumbers('player', { start: 6, end: 11 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'dead',
            frames: this.anims.generateFrameNumbers('player', { start: 54, end: 56 }),
            frameRate: 4,
            repeat: 0,
        });

        this.anims.create({
            key: 'laying',
            frames: this.anims.generateFrameNumbers('player', { start: 56, end: 56 }),
            frameRate: 4,
            repeat: 0
        })
    }

    override update() {  
        if (this.keys.up.isUp && this.keys.down.isUp && this.keys.left.isUp && this.keys.right.isUp && this.keys.space.isUp && !this.isKnockedDown) {
            this.player.anims.play('stand_' + this.lastDirection, true);
        }

        this.isAttacking = this.keys.space.isDown;
        if (this.player && this.player.anims && this.player.anims.currentAnim) {
            if (this.player.anims.currentAnim.key == 'stand_' + this.lastDirection) {
            }
        }

        if (!this.isKnockedDown) {
            if (this.keys.s1.isDown) {
                this.player.setVelocity(0, 0);
                this.isKnockedDown = true;
                this.player.anims.play('dead');
                this.player.anims.stopAfterRepeat(0);
                this.player.setStatic(true); 

                this.socket.emit('updatePlayers', {
                    posx: this.player.x, 
                    posy: this.player.y, 
                    velocityx: 0, 
                    velocityy: 0,
                    animation: this.player.anims.currentAnim, 
                    key: undefined
                });
                this.updateRemoteMovements();
                return;
            }

            if (this.isAttacking) {
                this.playerVelocity.x = 0;
                this.playerVelocity.y = 0;
                this.player.anims.play('attack_' + this.lastDirection, true);
            }

            if (this.isAttacking) {
                this.playerVelocity.x = 0;
                this.playerVelocity.y = 0;
                this.player.anims.play('attack_' + this.lastDirection, true);
            } else {
                if (this.keys.up.isDown) {
                    this.playerVelocity.y = -1;
                    if (this.playerVelocity.x == 0) {
                        this.player.anims.play('up', true);
                    }
                    this.lastDirection = "up";
                } else if (this.keys.down.isDown) {
                    this.playerVelocity.y = 1;
                    if (this.playerVelocity.x == 0) {
                        this.player.anims.play('down', true);
                    }
                    this.lastDirection = "down";
                } else {
                    this.playerVelocity.y = 0;
                }

                if (this.keys.left.isDown) {
                    this.player.setFlipX(true);
                    this.playerVelocity.x = -1;
                    this.player.anims.play('move_x', true);
                    this.lastDirection = "left";
                } else if (this.keys.right.isDown) {
                    this.playerVelocity.x = 1;
                    this.player.anims.play('move_x', true);
                    this.player.setFlipX(false);
                    this.lastDirection = "right";
                } else {
                    this.playerVelocity.x = 0;
                }
            }
            if(this.player.anims.currentAnim?.key !== 'dead')  {
                this.playerVelocity.normalize();
                this.playerVelocity.scale(1.2);
                this.player.setVelocity(this.playerVelocity.x, this.playerVelocity.y);
            
                this.socket.emit('updatePlayers', {
                    posx: this.player.x, 
                    posy: this.player.y, 
                    velocityx: this.playerVelocity.x, 
                    velocityy: this.playerVelocity.y, 
                    animation: this.player.anims.currentAnim,
                    key: this.player.anims.currentAnim?.key
                    });
                this.updateRemoteMovements();
            }
        }
    }

    private updateRemoteMovements() {
        if (this.others != null) {
            for (const playerId in this.others) {
                const other = this.others[playerId];
                if (playerId !== this.playerId) {
                    if (!this.otherSprites[playerId]) {
                        const newPlayer: Phaser.Physics.Matter.Sprite = this.matter.add.sprite(other.posx, other.posy, 'player');
                        newPlayer.setDisplaySize(70, 90);
                        newPlayer.setRectangle(20, 35);
                        newPlayer.setOrigin(0.5, 0.70);
                        newPlayer.setFixedRotation();
                        this.otherSprites[playerId] = newPlayer;

                        if (other.animation) {
                            if (other.animation.key === undefined || other.animation.key === 'dead'){
                                newPlayer.anims.play('laying');
                                newPlayer.setStatic(true);
                                newPlayer.anims.stopAfterRepeat(0);
                                return;
                            } else if (other.animation.key === 'move_x' && other.velocityx < 0) {
                                newPlayer.setFlipX(true);
                                newPlayer.anims.play(other.animation, true);
                            } else if(other.animation.key === 'move_x' && other.velocityx > 0){
                                newPlayer.anims.play(other.animation, true);
                                newPlayer.setFlipX(false);
                            } else{
                                newPlayer.anims.play(other.animation, true);
                            }   
                        }
                    }
                     else {
                        const existingSprite = this.otherSprites[playerId];
                        existingSprite.setPosition(other.posx, other.posy);
                        if (other.animation) {
                            if (other.animation.key === undefined || other.animation.key === 'dead'){
                                existingSprite.anims.play('laying');
                                existingSprite.setStatic(true);
                                existingSprite.anims.stopAfterRepeat(0);
                                return;
                            } else if (other.animation.key === 'move_x' && other.velocityx < 0) {
                                existingSprite.setFlipX(true);
                                existingSprite.anims.play(other.animation, true);
                            } else if(other.animation.key === 'move_x' && other.velocityx > 0){
                                existingSprite.anims.play(other.animation, true);
                                existingSprite.setFlipX(false);
                            } else {
                                existingSprite.anims.play(other.anima0tion, true);
                            }
                        }
                    }
                }
            }
        }
    }
}   