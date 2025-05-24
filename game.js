// --- グローバル設定 ---
const GAME_WIDTH = 450;
const GAME_HEIGHT = 800;
const PLAYER_INITIAL_X_LEFT = GAME_WIDTH * 0.25;
const PLAYER_INITIAL_X_RIGHT = GAME_WIDTH * 0.75;
const CPU_INITIAL_X_LEFT = GAME_WIDTH * 0.25;
const CPU_INITIAL_X_RIGHT = GAME_WIDTH * 0.75;

// アセットキー (仮)
const ASSETS = {
    BG_MAIN: 'backgroundMain',
    PLAYER_IDLE: 'playerIdle', PLAYER_READY: 'playerReady', PLAYER_WIN: 'playerWin', PLAYER_LOSE: 'playerLose',
    CPU1_IDLE: 'cpu1Idle', CPU1_READY: 'cpu1Ready', CPU1_WIN: 'cpu1Win', CPU1_LOSE: 'cpu1Lose',
    CPU2_IDLE: 'cpu2Idle', CPU2_READY: 'cpu2Ready', CPU2_WIN: 'cpu2Win', CPU2_LOSE: 'cpu2Lose',
    CPU3_IDLE: 'cpu3Idle', CPU3_READY: 'cpu3Ready', CPU3_WIN: 'cpu3Win', CPU3_LOSE: 'cpu3Lose',
    //SIGNAL_MARK: 'signalMark',
    BGM_VERSUS: 'bgmVersus',
    SE_CLASH: 'seClash'
};

const DIFFICULTIES = {
    easy:   { name: 'やさしい', minReact: 250, maxReact: 500, color: 0x88ff88, cpuAssetPrefix: 'CPU1', cpuDisplayName: '若武者' },
    normal: { name: 'ふつう',   minReact: 150, maxReact: 400, color: 0xffff88, cpuAssetPrefix: 'CPU2', cpuDisplayName: '剣豪' },
    hard:   { name: 'つよい',   minReact: 100, maxReact: 250, color: 0xff8888, cpuAssetPrefix: 'CPU3', cpuDisplayName: '剣聖' }
};
let currentDifficultyKey = 'normal';
let cpuMinReact = DIFFICULTIES[currentDifficultyKey].minReact;
let cpuMaxReact = DIFFICULTIES[currentDifficultyKey].maxReact;

const MAX_OPPONENTS = 3; // 各難易度で3人のCPUがいると仮定 (アセット上は1種類を使い回す)
let currentOpponentNumber = 1; // 1, 2, 3 (表示用)

let currentBgm = null;

// --- Title Scene ---
class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        console.log('[LOG] TitleScene preload: Started');
        this.load.image(ASSETS.BG_MAIN, `assets/${ASSETS.BG_MAIN}.png`);
        this.load.audio(ASSETS.BGM_VERSUS, [`assets/${ASSETS.BGM_VERSUS}.mp3`, `assets/${ASSETS.BGM_VERSUS}.ogg`]);
        console.log('[LOG] TitleScene preload: Finished');
    }

    create() {
        console.log('[LOG] TitleScene create: Started');
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ASSETS.BG_MAIN);

        this.createTextObjects();

        this.playTitleBGM();
        console.log('[LOG] TitleScene create: Finished');
    }

    playTitleBGM() {
        if (currentBgm && currentBgm.isPlaying && currentBgm.key === ASSETS.BGM_VERSUS) {
            // Do nothing if already playing the same BGM
        } else {
            if (currentBgm) currentBgm.stop();
            currentBgm = this.sound.add(ASSETS.BGM_VERSUS, { loop: true, volume: 0.4 }); // 音量少し調整
            currentBgm.play();
            console.log('[LOG] TitleScene: BGM playing');
        }
    }

    createTextObjects() {
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        this.add.text(gameWidth / 2, gameHeight * 0.15, '刹那の', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(gameWidth / 2, gameHeight * 0.25, 'SLASH', { fontSize: '52px', color: '#ffff00', fontStyle: 'italic bold' }).setOrigin(0.5);

        let yPos = gameHeight * 0.45;
        for (const diffKey in DIFFICULTIES) {
            const diff = DIFFICULTIES[diffKey];
            const button = this.add.rectangle(gameWidth / 2, yPos, gameWidth * 0.7, 65, diff.color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    currentDifficultyKey = diffKey;
                    currentOpponentNumber = 1; // リセット
                    this.scene.start('GameScene', { difficulty: currentDifficultyKey, opponentNum: currentOpponentNumber });
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
        this.playerSprite = null; this.cpuSprite = null; this.signalObject = null;
        this.infoText = null; this.resultText = null;
        this.gameState = 'waiting'; this.signalTime = undefined; this.playerReactTime = undefined;
        this.cpuReactTime = undefined; this.playerInputEnabled = false; this.cpuTimer = null;
        this.signalTimer = null; this.playerIsLeft = false; this.winLastRound = false;
    }

    init(data) {
        console.log('[LOG] GameScene init: Started with data:', data);
        currentDifficultyKey = (data && data.difficulty !== undefined) ? data.difficulty : 'normal';
        currentOpponentNumber = (data && data.opponentNum !== undefined) ? data.opponentNum : 1;

        const diffSetting = DIFFICULTIES[currentDifficultyKey];
        if (currentDifficultyKey === 'hard') {
            const baseMin = diffSetting.minReact;
            const baseMax = diffSetting.maxReact;
            // 対戦相手番号(1,2,3)に応じて調整 (0,1,2)として使う
            const reductionFactor = (currentOpponentNumber - 1) * 15;
            cpuMinReact = Math.max(80, baseMin - reductionFactor);
            cpuMaxReact = Math.max(150, baseMax - reductionFactor * 1.3);
            if (cpuMinReact >= cpuMaxReact - 10) cpuMinReact = cpuMaxReact - 20;
        } else {
            cpuMinReact = diffSetting.minReact;
            cpuMaxReact = diffSetting.maxReact;
        }
        this.gameState = 'waiting';
        console.log(`[LOG] GameScene init: Opponent ${currentOpponentNumber}, CPU React: ${cpuMinReact}-${cpuMaxReact}ms. gameState: ${this.gameState}`);
    }

    preload() {
        console.log('[LOG] GameScene preload: Started');
        // 背景 (TitleSceneでロード済みなら通常は不要)
        if (!this.textures.exists(ASSETS.BG_MAIN)) this.load.image(ASSETS.BG_MAIN, `assets/${ASSETS.BG_MAIN}.jpg`);
        // 主人公
        this.load.image(ASSETS.PLAYER_IDLE, `assets/${ASSETS.PLAYER_IDLE}.png`);
        this.load.image(ASSETS.PLAYER_READY, `assets/${ASSETS.PLAYER_READY}.png`);
        this.load.image(ASSETS.PLAYER_WIN, `assets/${ASSETS.PLAYER_WIN}.png`);
        this.load.image(ASSETS.PLAYER_LOSE, `assets/${ASSETS.PLAYER_LOSE}.png`);
        // CPU (難易度ごとにアセットプレフィックスを使用)
        for (const key in DIFFICULTIES) {
            const prefix = DIFFICULTIES[key].cpuAssetPrefix;
            this.load.image(`${prefix}_IDLE`, `assets/${prefix}_IDLE.png`);
            this.load.image(`${prefix}_READY`, `assets/${prefix}_READY.png`);
            this.load.image(`${prefix}_WIN`, `assets/${prefix}_WIN.png`);
            this.load.image(`${prefix}_LOSE`, `assets/${prefix}_LOSE.png`);
        }
      //  this.load.image(ASSETS.SIGNAL_MARK, `assets/${ASSETS.SIGNAL_MARK}.png`);
        this.load.audio(ASSETS.SE_CLASH, [`assets/${ASSETS.SE_CLASH}.mp3`, `assets/${ASSETS.SE_CLASH}.mp3`]);
        if (!this.sound.get(ASSETS.BGM_VERSUS)) this.load.audio(ASSETS.BGM_VERSUS, [`assets/${ASSETS.BGM_VERSUS}.mp3`, `assets/${ASSETS.BGM_VERSUS}.ogg`]);
        console.log('[LOG] GameScene preload: Finished');
    }

    create() {
        console.log('[LOG] GameScene create: Started');
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ASSETS.BG_MAIN);

        this.playerSprite = this.add.image(0, 0, ASSETS.PLAYER_IDLE).setOrigin(0.5);
        const cpuAssetPrefix = DIFFICULTIES[currentDifficultyKey].cpuAssetPrefix;
        this.cpuSprite = this.add.image(0, 0, `${cpuAssetPrefix}_IDLE`).setOrigin(0.5);
       // this.signalObject = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, ASSETS.SIGNAL_MARK).setOrigin(0.5).setVisible(false).setScale(1.2);
        this.infoText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.1, '', { fontSize: '30px', color: '#FFFFFF', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
        this.resultText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.58, '', { fontSize: '34px', color: '#FFFFFF', align: 'center', lineSpacing: 10 }).setOrigin(0.5);

        this.setGameState(this.gameState); // 'waiting'から開始

        this.input.off('pointerdown', this.handlePlayerInput, this);
        this.input.on('pointerdown', this.handlePlayerInput, this);
        console.log('[LOG] GameScene create: Finished');
    }

    playGameBGM() {
        // console.log(`[LOG] playGameBGM: currentBgm.isPlaying=${currentBgm ? currentBgm.isPlaying : 'null'}, key=${currentBgm ? currentBgm.key : 'null'}`);
        if (currentBgm && currentBgm.isPlaying && currentBgm.key === ASSETS.BGM_VERSUS) {
            // 既に同じBGMが再生中なら何もしない (シーンリスタート時など)
        } else {
            if (currentBgm) currentBgm.stop();
            currentBgm = this.sound.get(ASSETS.BGM_VERSUS) || this.sound.add(ASSETS.BGM_VERSUS);
            if (!currentBgm.isPlaying) { // 再生中でなければ再生
                currentBgm.play({ loop: true, volume: 0.4 });
                console.log('[LOG] GameScene: BGM playing');
            }
        }
    }

    stopGameBGM() {
        if (currentBgm && currentBgm.isPlaying) {
            currentBgm.stop();
            console.log('[LOG] GameScene: BGM stopped');
        }
    }

    setGameState(newState) {
        console.log(`[LOG] setGameState: Changing from ${this.gameState} to ${newState}`);
        this.gameState = newState;
        this.playerInputEnabled = false;
        if (this.cpuTimer) { this.cpuTimer.remove(false); this.cpuTimer = null; }
        if (this.signalTimer) { this.signalTimer.remove(false); this.signalTimer = null; }

        const cpuAssetPrefix = DIFFICULTIES[currentDifficultyKey].cpuAssetPrefix;

        switch (this.gameState) {
            case 'waiting':
                this.playGameBGM();
                if(this.playerSprite) this.playerSprite.setVisible(true).setTexture(ASSETS.PLAYER_IDLE);
                if(this.cpuSprite) this.cpuSprite.setVisible(true).setTexture(`${cpuAssetPrefix}_IDLE`);
                const opponentDisplayName = DIFFICULTIES[currentDifficultyKey].cpuDisplayName; // 表示用のCPU名
                if(this.infoText) this.infoText.setText(`${opponentDisplayName} (${currentOpponentNumber}/${MAX_OPPONENTS})\n画面をタップして開始`);
                if(this.resultText) this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false);
                this.playerIsLeft = false;
                if(this.playerSprite) this.playerSprite.setPosition(PLAYER_INITIAL_X_RIGHT, GAME_HEIGHT * 0.75);
                if(this.cpuSprite) this.cpuSprite.setPosition(CPU_INITIAL_X_LEFT, GAME_HEIGHT * 0.75);
                this.playerReactTime = undefined; this.cpuReactTime = undefined; this.signalTime = undefined;
                this.playerInputEnabled = true;
                break;
            case 'ready':
                if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_READY);
                if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetPrefix}_READY`);
                if(this.infoText) this.infoText.setText('構え！');
                this.playerInputEnabled = true;
                const waitTime = Phaser.Math.Between(1500, 3500);
                this.signalTimer = this.time.delayedCall(waitTime, this.showSignal, [], this);
                break;
            case 'signal':
                if(this.infoText) this.infoText.setText('斬！');
                if(this.signalObject) this.signalObject.setVisible(true);
                this.signalTime = this.time.now;
                this.playerInputEnabled = true;
                const cpuReactionDelay = Phaser.Math.Between(cpuMinReact, cpuMaxReact);
                this.cpuTimer = this.time.delayedCall(cpuReactionDelay, this.handleCpuInput, [], this);
                break;
            case 'result':
                this.stopGameBGM(); // 結果表示の最初にBGM停止
                this.playerInputEnabled = false;
                if(this.signalObject) this.signalObject.setVisible(false);
                this.time.delayedCall(600, () => { this.playerInputEnabled = true; });
                break;
            default:
                console.warn(`[LOG] setGameState: Unknown state ${newState}`);
        }
    }

    showSignal() {
        if (this.gameState === 'ready') this.setGameState('signal');
    }

    handlePlayerInput() {
        if (!this.playerInputEnabled) return;
        const currentTime = this.time.now;

        if (this.gameState === 'waiting') {
            this.setGameState('ready');
        } else if (this.gameState === 'ready') { // フライング
            this.playerReactTime = -1; this.cpuReactTime = 99999;
            if (this.signalTimer) { this.signalTimer.remove(); this.signalTimer = null; }
            // フライング時はperformResultLogicでテクスチャ設定
            this.performResultLogic();
        } else if (this.gameState === 'signal') {
            this.playerReactTime = currentTime - this.signalTime;
            this.playerInputEnabled = false;
            // プレイヤーの斬るテクスチャ変更はperformResultLogicで行う（勝敗に応じて）
            if (this.cpuReactTime !== undefined) this.showResult();
        } else if (this.gameState === 'result') {
            if (this.winLastRound) {
                if (currentOpponentNumber < MAX_OPPONENTS) {
                    currentOpponentNumber++;
                    this.scene.restart({ difficulty: currentDifficultyKey, opponentNum: currentOpponentNumber });
                } else {
                    if(this.resultText) this.resultText.setText(`${DIFFICULTIES[currentDifficultyKey].name} 制覇！\nタップしてタイトルへ`);
                    this.winLastRound = false; // 次のタップはタイトルへ
                }
            } else {
                this.scene.start('TitleScene'); // 敗北または制覇後のタップ
            }
        }
    }

    handleCpuInput() {
        if (this.gameState !== 'signal') return;
        if (this.signalTime === undefined) return;
        this.cpuReactTime = this.time.now - this.signalTime;
        // CPUの斬るテクスチャ変更はperformResultLogicで
        if (this.playerReactTime === undefined) {
            this.playerReactTime = 9999; this.playerInputEnabled = false;
        }
        this.showResult();
    }

    showResult() {
        if (this.gameState !== 'signal' && this.playerReactTime !== -1) return;
        this.sound.play(ASSETS.SE_CLASH, {volume: 0.6});
        const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.6).setDepth(100);
        this.time.delayedCall(70, () => { if(flash && flash.active) flash.destroy(); }); // activeチェック追加
        this.time.delayedCall(80, () => { // 少しタイミング調整
            this.playerIsLeft = !this.playerIsLeft;
            if(this.playerSprite) this.playerSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_LEFT : PLAYER_INITIAL_X_RIGHT);
            if(this.cpuSprite) this.cpuSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_RIGHT : CPU_INITIAL_X_LEFT);
            this.performResultLogic();
        });
    }

    performResultLogic() {
        if (this.gameState === 'result' && this.resultText && this.resultText.text !== '') { // 既に結果表示済みなら重複処理しない
             console.log('[LOG] performResultLogic: Already in result and text set, skipping.');
             return;
        }
        this.stopGameBGM(); // ここで確実にBGM停止
        this.setGameState('result'); // 必ず最初にステートを'result'に

        let message = '';
        const pReact = this.playerReactTime === undefined ? Infinity : this.playerReactTime;
        const cReact = this.cpuReactTime === undefined ? Infinity : this.cpuReactTime;
        this.winLastRound = false;
        const cpuAssetPrefix = DIFFICULTIES[currentDifficultyKey].cpuAssetPrefix;

        if (pReact === -1) {
            message = `お手つき！\nあなたの負け`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_LOSE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetPrefix}_WIN`);
        } else if (pReact === 9999 && cReact < 9999) {
            message = `遅い！\nあなたの負け\n(相手: ${cReact.toFixed(0)} ms)`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_LOSE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetPrefix}_WIN`);
        } else if (pReact < cReact) {
            message = `あなたの勝ち！\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_WIN);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetPrefix}_LOSE`);
            this.winLastRound = true;
            this.updateBestReaction(pReact);
        } else if (pReact > cReact) {
            message = `あなたの負け\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_LOSE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetPrefix}_WIN`);
        } else if (pReact === cReact && pReact !== 9999 && pReact !== -1 && pReact !== Infinity) {
            message = `引き分け！\n\n両者: ${pReact.toFixed(0)} ms`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_IDLE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetPrefix}_IDLE`);
        } else {
            message = `予期せぬエラー`;
            if(this.playerSprite) this.playerSprite.setTexture(ASSETS.PLAYER_LOSE);
            if(this.cpuSprite) this.cpuSprite.setTexture(`${cpuAssetPrefix}_IDLE`); // エラー時はCPUも待機
        }

        if (this.winLastRound) {
            if (currentOpponentNumber < MAX_OPPONENTS) {
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
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [TitleScene, GameScene]
};
// --- Phaserゲームの初期化 ---
const game = new Phaser.Game(config);

/* --- アセットファイル名一覧 (仮) ---
   以下の名前で assets/ フォルダ直下にファイルを配置してください。
   (拡張子は .png, .wav, .mp3, .ogg など適宜)

// 背景
backgroundMain.png

// 主人公
playerIdle.png
playerReady.png // 構え用。待機と同じ画像でもOK
playerWin.png
playerLose.png

// CPU1 (やさしい) - DIFFICULTIESのcpuAssetPrefixに対応
CPU1_IDLE.png
CPU1_READY.png
CPU1_WIN.png
CPU1_LOSE.png


// CPU2 (ふつう)
CPU2_IDLE.png
CPU2_READY.png
CPU2_WIN.png
CPU2_LOSE.png

// CPU3 (つよい)
CPU3_IDLE.png
CPU3_READY.png
CPU3_WIN.png
CPU3_LOSE.png

// 合図マーク
signalMark.png

// 音声
bgmVersus.mp3  (または .ogg) // タイトルとゲーム中共通
seClash.wav    (または .mp3) // 斬り合った音
------------------------------------ */