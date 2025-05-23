// --- グローバル設定 ---
const GAME_WIDTH = 400;
const GAME_HEIGHT = 700;
const PLAYER_INITIAL_X_LEFT = GAME_WIDTH * 0.25;
const PLAYER_INITIAL_X_RIGHT = GAME_WIDTH * 0.75;
const CPU_INITIAL_X_LEFT = GAME_WIDTH * 0.25;
const CPU_INITIAL_X_RIGHT = GAME_WIDTH * 0.75;

const DIFFICULTIES = {
    easy:   { name: 'やさしい', minReact: 250, maxReact: 500, color: 0x88ff88, cpuNames: ['若武者', '剣士', '達人'] },
    normal: { name: 'ふつう',   minReact: 150, maxReact: 400, color: 0xffff88, cpuNames: ['練達の士', '免許皆伝', '剣豪'] },
    hard:   { name: 'つよい',   minReact: 100, maxReact: 250, color: 0xff8888, cpuNames: ['修羅', '鬼神', '剣聖'] }
};
let currentDifficultyKey = 'normal';
let cpuMinReact = DIFFICULTIES[currentDifficultyKey].minReact;
let cpuMaxReact = DIFFICULTIES[currentDifficultyKey].maxReact;

const MAX_OPPONENTS = 3;
let currentOpponentIndex = 0;

// --- Title Scene ---
class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        // console.log('[LOG] TitleScene preload: Started');
    }

    create() {
        // console.log('[LOG] TitleScene create: Started');
        this.createTextObjects();
        // console.log('[LOG] TitleScene create: Finished');
    }

    createTextObjects() {
        this.cameras.main.setBackgroundColor('#333333');
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        this.add.text(gameWidth / 2, gameHeight * 0.15, '刹那の', {
            fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(gameWidth / 2, gameHeight * 0.25, 'MI・KI・RI', {
            fontSize: '52px', color: '#ffff00', fontStyle: 'italic bold',
        }).setOrigin(0.5);

        let yPos = gameHeight * 0.45;
        for (const diffKey in DIFFICULTIES) {
            const diff = DIFFICULTIES[diffKey];
            const button = this.add.rectangle(gameWidth / 2, yPos, gameWidth * 0.7, 65, diff.color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    currentDifficultyKey = diffKey;
                    currentOpponentIndex = 0;
                    // console.log(`[LOG] TitleScene: Starting GameScene with diff: ${currentDifficultyKey}, oppIdx: ${currentOpponentIndex}`);
                    this.scene.start('GameScene', { difficulty: currentDifficultyKey, opponentIndex: currentOpponentIndex });
                });
            this.add.text(button.x, button.y, diff.name, { fontSize: '32px', color: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            yPos += 90;
        }

        const scoreYStart = gameHeight * 0.78;
        this.add.text(gameWidth / 2, scoreYStart, '--- 戦績 ---', { fontSize: '24px', color: '#cccccc' }).setOrigin(0.5);
        const bestTime = localStorage.getItem('bestReactionTime') || '-';
        this.add.text(gameWidth / 2, scoreYStart + 30, `最速反応: ${bestTime}${bestTime !== '-' ? ' ms' : ''}`, { fontSize: '20px', color: '#E0E0E0' }).setOrigin(0.5);

        let scoreLineY = scoreYStart + 60;
        for (const diffKey in DIFFICULTIES) {
            const clears = localStorage.getItem(`${diffKey}_clears`) || '0';
            this.add.text(gameWidth / 2, scoreLineY, `${DIFFICULTIES[diffKey].name} クリア: ${clears}回`, { fontSize: '18px', color: '#B0B0B0' }).setOrigin(0.5);
            scoreLineY += 25;
        }
    }
}

// --- Game Scene ---
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playerSprite = null;
        this.cpuSprite = null;
        this.signalObject = null;
        this.infoText = null;
        this.resultText = null;
        this.cutsceneObjects = null;

        this.gameState = 'pre_battle'; // Default, will be set in init
        this.signalTime = undefined;
        this.playerReactTime = undefined;
        this.cpuReactTime = undefined;
        this.playerInputEnabled = false;
        this.cpuTimer = null;
        this.signalTimer = null;
        this.playerIsLeft = false;
        this.winLastRound = false;
    }

    init(data) {
        console.log('[LOG] GameScene init: Started with data:', data);
        try {
            currentDifficultyKey = (data && data.difficulty !== undefined) ? data.difficulty : 'normal';
            currentOpponentIndex = (data && data.opponentIndex !== undefined) ? data.opponentIndex : 0;

            const diffSetting = DIFFICULTIES[currentDifficultyKey];
            if (currentDifficultyKey === 'hard') {
                const baseMin = diffSetting.minReact;
                const baseMax = diffSetting.maxReact;
                const reductionFactor = currentOpponentIndex * 15;
                cpuMinReact = Math.max(80, baseMin - reductionFactor);
                cpuMaxReact = Math.max(150, baseMax - reductionFactor * 1.3);
                if (cpuMinReact >= cpuMaxReact - 10) cpuMinReact = cpuMaxReact - 20;
            } else {
                cpuMinReact = diffSetting.minReact;
                cpuMaxReact = diffSetting.maxReact;
            }
            console.log(`[LOG] GameScene init: CPU React set to ${cpuMinReact}-${cpuMaxReact}ms for Opponent ${currentOpponentIndex + 1}`);

            this.gameState = 'pre_battle';
            this.signalTime = undefined;
            this.playerReactTime = undefined;
            this.cpuReactTime = undefined;
            this.playerInputEnabled = false;
            this.cpuTimer = null;
            this.signalTimer = null;
            this.playerIsLeft = false; // Player starts on the right
            this.winLastRound = false;
            console.log('[LOG] GameScene init: Finished successfully. gameState set to:', this.gameState);
        } catch (error) {
            console.error('[FATAL LOG] Error in GameScene init:', error);
            if (error.stack) console.error('[FATAL LOG] Stack trace (init):', error.stack);
        }
    }

    preload() {
        console.log('[LOG] GameScene preload: Started');
        // console.log('GameScene Preloading...'); // Original log
        console.log('[LOG] GameScene preload: Finished');
    }

    create() {
        console.log('[LOG] GameScene create: Started');
        try {
            // console.log('GameScene Creating...'); // Original log
            this.cameras.main.setBackgroundColor('#4488AA');
            const gameWidth = this.cameras.main.width;
            const gameHeight = this.cameras.main.height;

            console.log('[LOG] GameScene create: Creating playerSprite');
            this.playerSprite = this.add.rectangle(0, 0, 60, 100, 0x00ff00).setOrigin(0.5);
            console.log('[LOG] GameScene create: Creating cpuSprite');
            this.cpuSprite = this.add.rectangle(0, 0, 60, 100, 0xff0000).setOrigin(0.5);

            console.log('[LOG] GameScene create: Creating signalObject');
            this.signalObject = this.add.text(gameWidth / 2, gameHeight * 0.4, '！', { fontSize: '120px', color: '#FFFF00', fontStyle: 'bold' })
                .setOrigin(0.5)
                .setVisible(false);

            console.log('[LOG] GameScene create: Creating infoText');
            this.infoText = this.add.text(gameWidth / 2, gameHeight * 0.1, '', { fontSize: '32px', color: '#FFFFFF', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
            console.log('[LOG] GameScene create: Creating resultText');
            this.resultText = this.add.text(gameWidth / 2, gameHeight * 0.58, '', { fontSize: '36px', color: '#FFFFFF', align: 'center', lineSpacing: 10 }).setOrigin(0.5);

            console.log('[LOG] GameScene create: About to call setGameState with state:', this.gameState);
            this.setGameState(this.gameState);

            console.log('[LOG] GameScene create: Adding input listener');
            this.input.off('pointerdown', this.handlePlayerInput, this); // Remove old listener if any from previous scene instance (safety)
            this.input.on('pointerdown', this.handlePlayerInput, this);

            console.log('[LOG] GameScene create: Finished successfully');
        } catch (error) {
            console.error('[FATAL LOG] Error in GameScene create:', error);
            if (error.stack) console.error('[FATAL LOG] Stack trace (create):', error.stack);
        }
    }

    setGameState(newState) {
        console.log(`[LOG] setGameState: Changing from ${this.gameState} to ${newState}`);
        this.gameState = newState;
        this.playerInputEnabled = false;
        // console.log("State changed to:", this.gameState); // Original log

        if (this.cpuTimer) { this.cpuTimer.remove(false); this.cpuTimer = null; }
        if (this.signalTimer) { this.signalTimer.remove(false); this.signalTimer = null; }

        if (this.cutsceneObjects) {
            this.cutsceneObjects.setVisible(this.gameState === 'pre_battle');
        }

        switch (this.gameState) {
            case 'pre_battle':
                console.log('[LOG] setGameState pre_battle: Started setup');
                this.playerReactTime = undefined;
                this.cpuReactTime = undefined;
                this.signalTime = undefined;

                console.log('[LOG] setGameState pre_battle: Setting sprite visibility');
                if (this.playerSprite) this.playerSprite.setVisible(false); else console.warn('[LOG] playerSprite is null in pre_battle setup');
                if (this.cpuSprite) this.cpuSprite.setVisible(false); else console.warn('[LOG] cpuSprite is null in pre_battle setup');
                if (this.signalObject) this.signalObject.setVisible(false); else console.warn('[LOG] signalObject is null in pre_battle setup');

                console.log('[LOG] setGameState pre_battle: Setting text');
                if (this.infoText) this.infoText.setText(''); else console.warn('[LOG] infoText is null in pre_battle setup');
                if (this.resultText) this.resultText.setText(''); else console.warn('[LOG] resultText is null in pre_battle setup');

                console.log('[LOG] setGameState pre_battle: Scheduling showPreBattleCutscene');
                this.time.delayedCall(10, () => {
                    console.log('[LOG] setGameState pre_battle (delayedCall): Executing showPreBattleCutscene');
                    this.showPreBattleCutscene();
                }, [], this);

                this.playerInputEnabled = true;
                console.log('[LOG] setGameState pre_battle: Finished setup');
                break;

            case 'waiting':
                console.log('[LOG] setGameState waiting: Started setup');
                if(this.playerSprite) this.playerSprite.setVisible(true);
                if(this.cpuSprite) this.cpuSprite.setVisible(true);
                if(this.infoText) this.infoText.setText(`相手: ${DIFFICULTIES[currentDifficultyKey].cpuNames[currentOpponentIndex]} (${currentOpponentIndex + 1}/${MAX_OPPONENTS})\n画面をタップして開始`);
                if(this.resultText) this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false);

                this.playerIsLeft = false;
                if(this.playerSprite) this.playerSprite.setPosition(PLAYER_INITIAL_X_RIGHT, GAME_HEIGHT * 0.75).setFillStyle(0x00ff00);
                if(this.cpuSprite) this.cpuSprite.setPosition(CPU_INITIAL_X_LEFT, GAME_HEIGHT * 0.75).setFillStyle(0xff0000);

                this.playerReactTime = undefined;
                this.cpuReactTime = undefined;
                this.signalTime = undefined;
                this.playerInputEnabled = true;
                console.log('[LOG] setGameState waiting: Finished setup');
                break;

            case 'ready':
                console.log('[LOG] setGameState ready: Started setup');
                if(this.infoText) this.infoText.setText('構え！');
                if(this.resultText) this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false);
                this.playerInputEnabled = true;

                const waitTime = Phaser.Math.Between(1500, 3500);
                console.log(`[LOG] setGameState ready: Signal in ${waitTime} ms`);
                this.signalTimer = this.time.delayedCall(waitTime, this.showSignal, [], this);
                console.log('[LOG] setGameState ready: Finished setup');
                break;

            case 'signal':
                console.log('[LOG] setGameState signal: Started setup');
                if(this.infoText) this.infoText.setText('斬！');
                if(this.signalObject) this.signalObject.setVisible(true);
                this.signalTime = this.time.now;
                this.playerInputEnabled = true;

                const cpuReactionDelay = Phaser.Math.Between(cpuMinReact, cpuMaxReact);
                console.log(`[LOG] setGameState signal: CPU will react in ${cpuReactionDelay} ms (Min: ${cpuMinReact}, Max: ${cpuMaxReact})`);
                this.cpuTimer = this.time.delayedCall(cpuReactionDelay, this.handleCpuInput, [], this);
                console.log('[LOG] setGameState signal: Finished setup');
                break;

            case 'result':
                console.log('[LOG] setGameState result: Started setup');
                this.playerInputEnabled = false;
                if(this.signalObject) this.signalObject.setVisible(false);
                this.time.delayedCall(600, () => { this.playerInputEnabled = true; });
                console.log('[LOG] setGameState result: Finished setup');
                break;
            default:
                console.warn(`[LOG] setGameState: Unknown state ${newState}`);
        }
    }

    showPreBattleCutscene() {
        console.log('[LOG] showPreBattleCutscene: Started');
        try {
            console.log('[LOG] showPreBattleCutscene: Checking old cutsceneObjects');
            if (this.cutsceneObjects) {
                console.log('[LOG] showPreBattleCutscene: Destroying old cutsceneObjects');
                this.cutsceneObjects.clear(true, true); // Destroy children and remove them from the group
                this.cutsceneObjects.destroy();         // Destroy the group itself
                this.cutsceneObjects = null;
                console.log('[LOG] showPreBattleCutscene: Old cutsceneObjects destroyed');
            }

            const gameWidth = this.cameras.main.width;
            const gameHeight = this.cameras.main.height;
            console.log(`[LOG] showPreBattleCutscene: gameWidth=${gameWidth}, gameHeight=${gameHeight}`);

            console.log('[LOG] showPreBattleCutscene: Creating new group for cutsceneObjects');
            this.cutsceneObjects = this.add.group();
            console.log('[LOG] showPreBattleCutscene: New group created');

            const bandHeight = gameHeight * 0.2;
            console.log('[LOG] showPreBattleCutscene: Adding band rectangle');
            const band = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth * 0.9, bandHeight, 0x000000, 0.8);
            console.log('[LOG] showPreBattleCutscene: Band rectangle added');
            console.log('[LOG] showPreBattleCutscene: Setting band strokeStyle');
            band.setStrokeStyle(2, 0xffffff);
            console.log('[LOG] showPreBattleCutscene: Adding band to group');
            this.cutsceneObjects.add(band);

            const playerName = "あなた";
            const cpuName = DIFFICULTIES[currentDifficultyKey].cpuNames[currentOpponentIndex];
            console.log(`[LOG] showPreBattleCutscene: playerName=${playerName}, cpuName=${cpuName}`);

            console.log('[LOG] showPreBattleCutscene: Adding vsText');
            const vsText = this.add.text(gameWidth/2, gameHeight/2, `${playerName}\nVS\n${cpuName}`, {
                fontSize: '30px', color: '#ffffff', align: 'center', fontStyle: 'bold', lineSpacing: 8
            }).setOrigin(0.5);
            console.log('[LOG] showPreBattleCutscene: vsText added');
            console.log('[LOG] showPreBattleCutscene: Adding vsText to group');
            this.cutsceneObjects.add(vsText);

            console.log('[LOG] showPreBattleCutscene: Adding tapToStartText');
            const tapToStartText = this.add.text(gameWidth/2, gameHeight/2 + bandHeight/2 + 30, '画面をタップ', {
                fontSize: '22px', color: '#cccccc', align: 'center'
            }).setOrigin(0.5);
            console.log('[LOG] showPreBattleCutscene: tapToStartText added');
            console.log('[LOG] showPreBattleCutscene: Adding tapToStartText to group');
            this.cutsceneObjects.add(tapToStartText);

            console.log('[LOG] showPreBattleCutscene: Setting cutsceneObjects visible');
            this.cutsceneObjects.setVisible(true);
            console.log('[LOG] showPreBattleCutscene: Finished successfully');

        } catch (error) {
            console.error('[FATAL LOG] Error in showPreBattleCutscene:', error);
            if (error.stack) console.error('[FATAL LOG] Stack trace (showPreBattleCutscene):', error.stack);
        }
    }

    showSignal() {
        if (this.gameState === 'ready') {
            this.setGameState('signal');
        }
    }

    handlePlayerInput() {
        // console.log(`[LOG] handlePlayerInput: Called in state ${this.gameState}, inputEnabled: ${this.playerInputEnabled}`);
        if (!this.playerInputEnabled) return;
        const currentTime = this.time.now;

        if (this.gameState === 'pre_battle') {
            console.log('[LOG] handlePlayerInput: pre_battle tap');
            if (this.cutsceneObjects) this.cutsceneObjects.setVisible(false);
            this.setGameState('waiting');
        } else if (this.gameState === 'waiting') {
            console.log('[LOG] handlePlayerInput: waiting tap');
            this.setGameState('ready');
        } else if (this.gameState === 'ready') {
            console.log('[LOG] handlePlayerInput: ready tap (False Start!)');
            this.playerReactTime = -1;
            this.cpuReactTime = 99999;
            if (this.signalTimer) { this.signalTimer.remove(); this.signalTimer = null; }
            if(this.playerSprite) this.playerSprite.setFillStyle(0xaaaaaa);
            this.performResultLogic();
        } else if (this.gameState === 'signal') {
            console.log('[LOG] handlePlayerInput: signal tap');
            this.playerReactTime = currentTime - this.signalTime;
            this.playerInputEnabled = false;
            if (this.cpuReactTime !== undefined) {
                this.showResult();
            }
        } else if (this.gameState === 'result') {
            console.log('[LOG] handlePlayerInput: result tap');
            if (this.winLastRound) {
                if (currentOpponentIndex < MAX_OPPONENTS - 1) {
                    currentOpponentIndex++;
                    console.log(`[LOG] handlePlayerInput (result): Restarting for Opponent Index: ${currentOpponentIndex}, Difficulty: ${currentDifficultyKey}`);
                    this.scene.restart({ difficulty: currentDifficultyKey, opponentIndex: currentOpponentIndex });
                } else {
                    console.log('[LOG] handlePlayerInput (result): All opponents cleared, going to TitleScene');
                    if(this.resultText) this.resultText.setText(`${DIFFICULTIES[currentDifficultyKey].name} 制覇！\nタップしてタイトルへ`);
                    this.winLastRound = false; // So next tap goes to title
                }
            } else {
                console.log('[LOG] handlePlayerInput (result): Lost or draw, going to TitleScene');
                this.scene.start('TitleScene');
            }
        }
    }

    handleCpuInput() {
        // console.log(`[LOG] handleCpuInput: Called in state ${this.gameState}`);
        if (this.gameState !== 'signal') return;
        if (this.signalTime === undefined) {
            console.warn('[LOG] handleCpuInput: signalTime is undefined');
            return;
        }
        this.cpuReactTime = this.time.now - this.signalTime;
        console.log(`[LOG] handleCpuInput: CPU Reaction: ${this.cpuReactTime.toFixed(2)} ms`);

        if (this.playerReactTime === undefined) {
            this.playerReactTime = 9999;
            this.playerInputEnabled = false;
            console.log('[LOG] handleCpuInput: Player did not react in time');
        }
        this.showResult();
    }

    showResult() {
        console.log(`[LOG] showResult: Called in state ${this.gameState}`);
        if (this.gameState !== 'signal') {
            // This can happen if player false starts, performResultLogic is called directly.
            // If it's not a false start, then it's an issue.
            if (this.playerReactTime !== -1) { // Not a false start
                 console.warn(`[LOG] showResult: Called in unexpected state ${this.gameState} and not a false start. Bailing.`);
                 return;
            }
        }

        const flash = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.7)
            .setDepth(100);
        this.time.delayedCall(80, () => { if(flash) flash.destroy(); });

        this.time.delayedCall(90, () => {
            console.log('[LOG] showResult (delayedCall): Performing position swap and result logic');
            this.playerIsLeft = !this.playerIsLeft;
            if(this.playerSprite) this.playerSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_LEFT : PLAYER_INITIAL_X_RIGHT);
            if(this.cpuSprite) this.cpuSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_RIGHT : CPU_INITIAL_X_LEFT);
            this.performResultLogic();
        });
    }

    performResultLogic() {
        console.log('[LOG] performResultLogic: Started');
        this.setGameState('result'); // Set state to 'result' first

        let message = '';
        const pReact = this.playerReactTime === undefined ? Infinity : this.playerReactTime;
        const cReact = this.cpuReactTime === undefined ? Infinity : this.cpuReactTime;
        this.winLastRound = false;

        console.log(`[LOG] performResultLogic: Player React: ${pReact.toFixed(0)}, CPU React: ${cReact.toFixed(0)}`);

        if (pReact === -1) {
            message = `お手つき！\nあなたの負け`;
            if(this.playerSprite) this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact === 9999 && cReact < 9999) {
            message = `遅い！\nあなたの負け\n(相手: ${cReact.toFixed(0)} ms)`;
            if(this.playerSprite) this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact < cReact) {
            message = `あなたの勝ち！\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            if(this.cpuSprite) this.cpuSprite.setFillStyle(0xaaaaaa);
            this.winLastRound = true;
            this.updateBestReaction(pReact);
        } else if (pReact > cReact) {
            message = `あなたの負け\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            if(this.playerSprite) this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact === cReact && pReact !== 9999 && pReact !== -1 && pReact !== Infinity) {
            message = `引き分け！\n\n両者: ${pReact.toFixed(0)} ms`;
        } else {
            message = `予期せぬエラー\nもう一度試してください`;
            if(this.playerSprite) this.playerSprite.setFillStyle(0xaaaaaa);
        }

        if (this.winLastRound) {
            if (currentOpponentIndex < MAX_OPPONENTS - 1) {
                message += `\n\nタップして次の相手へ`;
            } else {
                message += `\n\n${DIFFICULTIES[currentDifficultyKey].name} 制覇！\nタップしてタイトルへ`;
                this.updateClearCount(currentDifficultyKey);
            }
        } else {
             message += `\n\nタップしてタイトルへ`;
        }
        if(this.resultText) this.resultText.setText(message);
        console.log('[LOG] performResultLogic: Finished');
    }

    updateBestReaction(reactionTime) {
        if (reactionTime < 0 || reactionTime >= 9999) return;
        const bestTime = parseFloat(localStorage.getItem('bestReactionTime')) || Infinity;
        if (reactionTime < bestTime) {
            localStorage.setItem('bestReactionTime', reactionTime.toFixed(0));
            console.log('[LOG] updateBestReaction: New best time saved:', reactionTime.toFixed(0));
        }
    }

    updateClearCount(difficultyKey) {
        const key = `${difficultyKey}_clears`;
        let clears = parseInt(localStorage.getItem(key)) || 0;
        clears++;
        localStorage.setItem(key, clears.toString());
        console.log(`[LOG] updateClearCount: Difficulty ${difficultyKey} clears updated to ${clears}`);
    }
}

// --- Phaserゲーム設定 ---
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [TitleScene, GameScene]
};

// --- Phaserゲームの初期化 ---
console.log('[LOG] Initializing Phaser Game');
const game = new Phaser.Game(config);
console.log('[LOG] Phaser Game Initialized');