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

    create() {
        console.log('[LOG] TitleScene create: Started');
        try {
            this.createTextObjects();
            console.log('[LOG] TitleScene create: Finished successfully');
        } catch (error) {
            console.error('[FATAL LOG] Error in TitleScene create:', error);
            if (error.stack) console.error('[FATAL LOG] Stack trace (TitleScene create):', error.stack);
        }
    }

    createTextObjects() {
        console.log('[LOG] TitleScene createTextObjects: Started');
        if (!this.cameras || !this.cameras.main) {
            console.error('[FATAL LOG] TitleScene: this.cameras.main is not available!');
            return;
        }
        this.cameras.main.setBackgroundColor('#333333');
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        this.add.text(gameWidth / 2, gameHeight * 0.15, '刹那の', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(gameWidth / 2, gameHeight * 0.25, 'MI・KI・RI', { fontSize: '52px', color: '#ffff00', fontStyle: 'italic bold' }).setOrigin(0.5);

        let yPos = gameHeight * 0.45;
        for (const diffKey in DIFFICULTIES) {
            const diff = DIFFICULTIES[diffKey];
            const button = this.add.rectangle(gameWidth / 2, yPos, gameWidth * 0.7, 65, diff.color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    currentDifficultyKey = diffKey;
                    currentOpponentIndex = 0;
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
        console.log('[LOG] TitleScene createTextObjects: Finished');
    }
}

// --- Game Scene ---
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        // プロパティの初期化
        this.playerSprite = null;
        this.cpuSprite = null;
        this.signalObject = null;
        this.infoText = null;
        this.resultText = null;
        // this.cutsceneObjects = null; // カットインがないので不要

        this.gameState = 'waiting'; // 初期状態は 'waiting'
        this.signalTime = undefined;
        this.playerReactTime = undefined;
        this.cpuReactTime = undefined;
        this.playerInputEnabled = false;
        this.cpuTimer = null;
        this.signalTimer = null;
        this.playerIsLeft = false; // プレイヤーは右から開始
        this.winLastRound = false;
    }

    init(data) {
        console.log('[LOG] GameScene init: Started with data:', data);
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
        console.log(`[LOG] GameScene init: CPU React for Opponent ${currentOpponentIndex + 1}: ${cpuMinReact}-${cpuMaxReact}ms`);
        this.gameState = 'waiting'; // initの最後で gameState を 'waiting' に設定
        console.log('[LOG] GameScene init: Finished. gameState set to:', this.gameState);
    }

    preload() {
        console.log('[LOG] GameScene preload: Started');
    }

    create() {
        console.log('[LOG] GameScene create: Started');
        this.cameras.main.setBackgroundColor('#4488AA');
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        this.playerSprite = this.add.rectangle(0, 0, 60, 100, 0x00ff00).setOrigin(0.5);
        this.cpuSprite = this.add.rectangle(0, 0, 60, 100, 0xff0000).setOrigin(0.5);
        this.signalObject = this.add.text(gameWidth / 2, gameHeight * 0.4, '！', { fontSize: '120px', color: '#FFFF00', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false);
        this.infoText = this.add.text(gameWidth / 2, gameHeight * 0.1, '', { fontSize: '32px', color: '#FFFFFF', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
        this.resultText = this.add.text(gameWidth / 2, gameHeight * 0.58, '', { fontSize: '36px', color: '#FFFFFF', align: 'center', lineSpacing: 10 }).setOrigin(0.5);

        this.setGameState(this.gameState); // initで設定された 'waiting' 状態を開始

        this.input.off('pointerdown', this.handlePlayerInput, this); //念のため古いリスナーを削除
        this.input.on('pointerdown', this.handlePlayerInput, this);
        console.log('[LOG] GameScene create: Finished');
    }

    setGameState(newState) {
        console.log(`[LOG] setGameState: Changing from ${this.gameState} to ${newState}`);
        this.gameState = newState;
        this.playerInputEnabled = false;

        if (this.cpuTimer) { this.cpuTimer.remove(false); this.cpuTimer = null; }
        if (this.signalTimer) { this.signalTimer.remove(false); this.signalTimer = null; }

        // if (this.cutsceneObjects) { // カットインがないので不要
        //     this.cutsceneObjects.setVisible(this.gameState === 'pre_battle');
        // }

        switch (this.gameState) {
            // case 'pre_battle': // カットインがないので不要
            //     break;
            case 'waiting':
                console.log('[LOG] setGameState waiting: Started');
                if(this.playerSprite) this.playerSprite.setVisible(true);
                if(this.cpuSprite) this.cpuSprite.setVisible(true);
                if(this.infoText) this.infoText.setText(`相手: ${DIFFICULTIES[currentDifficultyKey].cpuNames[currentOpponentIndex]} (${currentOpponentIndex + 1}/${MAX_OPPONENTS})\n画面をタップして開始`);
                if(this.resultText) this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false);

                this.playerIsLeft = false; // 常に右から開始
                if(this.playerSprite) this.playerSprite.setPosition(PLAYER_INITIAL_X_RIGHT, GAME_HEIGHT * 0.75).setFillStyle(0x00ff00);
                if(this.cpuSprite) this.cpuSprite.setPosition(CPU_INITIAL_X_LEFT, GAME_HEIGHT * 0.75).setFillStyle(0xff0000);

                this.playerReactTime = undefined;
                this.cpuReactTime = undefined;
                this.signalTime = undefined;
                this.playerInputEnabled = true;
                console.log('[LOG] setGameState waiting: Finished');
                break;
            case 'ready':
                console.log('[LOG] setGameState ready: Started');
                if(this.infoText) this.infoText.setText('構え！');
                if(this.resultText) this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false);
                this.playerInputEnabled = true;
                const waitTime = Phaser.Math.Between(1500, 3500);
                this.signalTimer = this.time.delayedCall(waitTime, this.showSignal, [], this);
                console.log('[LOG] setGameState ready: Finished');
                break;
            case 'signal':
                console.log('[LOG] setGameState signal: Started');
                if(this.infoText) this.infoText.setText('斬！');
                if(this.signalObject) this.signalObject.setVisible(true);
                this.signalTime = this.time.now;
                this.playerInputEnabled = true;
                const cpuReactionDelay = Phaser.Math.Between(cpuMinReact, cpuMaxReact);
                this.cpuTimer = this.time.delayedCall(cpuReactionDelay, this.handleCpuInput, [], this);
                console.log('[LOG] setGameState signal: Finished');
                break;
            case 'result':
                console.log('[LOG] setGameState result: Started');
                this.playerInputEnabled = false;
                if(this.signalObject) this.signalObject.setVisible(false);
                this.time.delayedCall(600, () => { this.playerInputEnabled = true; });
                console.log('[LOG] setGameState result: Finished');
                break;
            default:
                console.warn(`[LOG] setGameState: Unknown state ${newState}`);
        }
    }

    // showPreBattleCutscene() { // カットインがないので不要
    // }

    showSignal() {
        if (this.gameState === 'ready') {
            this.setGameState('signal');
        }
    }

    handlePlayerInput() {
        if (!this.playerInputEnabled) return;
        const currentTime = this.time.now;

        // if (this.gameState === 'pre_battle') { // カットインがないので不要
        // } else
        if (this.gameState === 'waiting') {
            this.setGameState('ready');
        } else if (this.gameState === 'ready') {
            this.playerReactTime = -1;
            this.cpuReactTime = 99999;
            if (this.signalTimer) { this.signalTimer.remove(); this.signalTimer = null; }
            if(this.playerSprite) this.playerSprite.setFillStyle(0xaaaaaa);
            this.performResultLogic(); // フライング時は直接結果ロジックへ
        } else if (this.gameState === 'signal') {
            this.playerReactTime = currentTime - this.signalTime;
            this.playerInputEnabled = false;
            if (this.cpuReactTime !== undefined) { // CPUが既に入力済みの場合
                this.showResult();
            }
        } else if (this.gameState === 'result') {
            if (this.winLastRound) {
                if (currentOpponentIndex < MAX_OPPONENTS - 1) {
                    currentOpponentIndex++;
                    this.scene.restart({ difficulty: currentDifficultyKey, opponentIndex: currentOpponentIndex });
                } else { // 3人抜き達成
                    if(this.resultText) this.resultText.setText(`${DIFFICULTIES[currentDifficultyKey].name} 制覇！\nタップしてタイトルへ`);
                    this.winLastRound = false; // 次のタップでタイトルに戻るように
                }
            } else { // 敗北または3人抜き後のタップ
                this.scene.start('TitleScene');
            }
        }
    }

    handleCpuInput() {
        if (this.gameState !== 'signal') return;
        if (this.signalTime === undefined) return;
        this.cpuReactTime = this.time.now - this.signalTime;
        if (this.playerReactTime === undefined) {
            this.playerReactTime = 9999;
            this.playerInputEnabled = false;
        }
        this.showResult();
    }

    showResult() {
        if (this.gameState !== 'signal' && this.playerReactTime !== -1 /*フライングでない場合*/) {
            console.warn(`[LOG] showResult: Called in unexpected state ${this.gameState}. Bailing.`);
            return;
        }
        const flash = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.7).setDepth(100);
        this.time.delayedCall(80, () => { if(flash) flash.destroy(); });
        this.time.delayedCall(90, () => {
            this.playerIsLeft = !this.playerIsLeft;
            if(this.playerSprite) this.playerSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_LEFT : PLAYER_INITIAL_X_RIGHT);
            if(this.cpuSprite) this.cpuSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_RIGHT : CPU_INITIAL_X_LEFT);
            this.performResultLogic();
        });
    }

    performResultLogic() {
        this.setGameState('result');
        let message = '';
        const pReact = this.playerReactTime === undefined ? Infinity : this.playerReactTime;
        const cReact = this.cpuReactTime === undefined ? Infinity : this.cpuReactTime;
        this.winLastRound = false;

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
            message = `予期せぬエラー`;
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
    }

    updateBestReaction(reactionTime) {
        if (reactionTime < 0 || reactionTime >= 9999) return;
        const bestTime = parseFloat(localStorage.getItem('bestReactionTime')) || Infinity;
        if (reactionTime < bestTime) {
            localStorage.setItem('bestReactionTime', reactionTime.toFixed(0));
        }
    }

    updateClearCount(difficultyKey) {
        const key = `${difficultyKey}_clears`;
        let clears = parseInt(localStorage.getItem(key)) || 0;
        clears++;
        localStorage.setItem(key, clears.toString());
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
const game = new Phaser.Game(config);