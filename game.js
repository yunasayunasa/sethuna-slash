// --- グローバル設定 ---
const GAME_WIDTH = 400;
const GAME_HEIGHT = 700;
const PLAYER_INITIAL_X_LEFT = GAME_WIDTH * 0.25; // プレイヤー初期位置 (左側)
const PLAYER_INITIAL_X_RIGHT = GAME_WIDTH * 0.75; // プレイヤー初期位置 (右側、入れ替え後)
const CPU_INITIAL_X_LEFT = GAME_WIDTH * 0.25;   // CPU初期位置 (左側、入れ替え後)
const CPU_INITIAL_X_RIGHT = GAME_WIDTH * 0.75;  // CPU初期位置 (右側)

// 難易度設定
const DIFFICULTIES = {
    easy:   { name: 'やさしい', minReact: 250, maxReact: 500, color: 0x88ff88 },
    normal: { name: 'ふつう',   minReact: 150, maxReact: 400, color: 0xffff88 },
    hard:   { name: 'つよい',   minReact: 100, maxReact: 250, color: 0xff8888 }
};
let currentDifficulty = 'normal'; // デフォルト難易度
let cpuMinReact = DIFFICULTIES[currentDifficulty].minReact;
let cpuMaxReact = DIFFICULTIES[currentDifficulty].maxReact;

// ゲームモード設定
const MAX_OPPONENTS = 3; // 1難易度あたりの対戦相手の数
let currentOpponent = 1; // 現在の対戦相手 (1, 2, 3)

// --- Title Scene ---
class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        // タイトル画面用アセットがあればここで読み込む
        // this.load.image('title_logo', 'assets/title_logo.png');
    }

    create() {
        this.cameras.main.setBackgroundColor('#333333');
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        this.add.text(gameWidth / 2, gameHeight * 0.2, '刹那の見斬り風', { fontSize: '40px', color: '#ffffff' }).setOrigin(0.5);

        // 難易度選択ボタン
        let yPos = gameHeight * 0.4;
        for (const diffKey in DIFFICULTIES) {
            const diff = DIFFICULTIES[diffKey];
            const button = this.add.rectangle(gameWidth / 2, yPos, gameWidth * 0.6, 60, diff.color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    currentDifficulty = diffKey;
                    cpuMinReact = diff.minReact;
                    cpuMaxReact = diff.maxReact;
                    currentOpponent = 1; // 難易度選択でリセット
                    this.scene.start('GameScene', { difficulty: currentDifficulty, opponentNum: currentOpponent });
                });
            this.add.text(button.x, button.y, diff.name, { fontSize: '28px', color: '#000000' }).setOrigin(0.5);
            yPos += 80;
        }

        // スコア表示エリア (仮)
        this.add.text(gameWidth / 2, gameHeight * 0.8, 'Scores (TBD)', { fontSize: '24px', color: '#cccccc' }).setOrigin(0.5);
        // TODO: localStorageからスコアを読み込んで表示する
        // 例: const bestTime = localStorage.getItem('bestReactionTime') || '-';
        //     this.add.text(gameWidth / 2, gameHeight * 0.85, `Best Reaction: ${bestTime} ms`, { fontSize: '20px', color: '#cccccc' }).setOrigin(0.5);
    }
}

// --- Game Scene ---
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // GameScene固有のプロパティ
        this.gameState = 'waiting';
        this.signalTime = undefined;
        this.playerReactTime = undefined;
        this.cpuReactTime = undefined;
        this.signalObject = null;
        this.infoText = null;
        this.resultText = null;
        this.playerInputEnabled = false;
        this.cpuTimer = null;
        this.signalTimer = null;

        this.playerSprite = null;
        this.cpuSprite = null;

        this.playerIsLeft = true; // プレイヤーが左側にいるかフラグ
    }

    init(data) {
        // TitleSceneから渡されたデータを受け取る
        currentDifficulty = data.difficulty || 'normal'; // 安全策
        currentOpponent = data.opponentNum || 1;
        cpuMinReact = DIFFICULTIES[currentDifficulty].minReact;
        cpuMaxReact = DIFFICULTIES[currentDifficulty].maxReact;
        console.log(`Game Start: Difficulty ${currentDifficulty}, Opponent ${currentOpponent}`);
    }

    preload() {
        // ゲームシーン用アセット
        // this.load.image('player_char', 'assets/player.png');
        // this.load.image('cpu_char', 'assets/cpu.png');
        // this.load.image('signal_icon', 'assets/signal_icon.png');
        // this.load.audio('slashSound', 'assets/slash.mp3');
        console.log('GameScene Preloading...');
    }

    create() {
        console.log('GameScene Creating...');
        this.cameras.main.setBackgroundColor('#4488AA');
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        // プレイヤーとCPUの初期位置設定
        this.playerIsLeft = true; // 最初の対戦ではプレイヤーは左

        this.playerSprite = this.add.rectangle(
            this.playerIsLeft ? PLAYER_INITIAL_X_LEFT : PLAYER_INITIAL_X_RIGHT,
            gameHeight * 0.75, 60, 100, 0x00ff00).setOrigin(0.5);
        this.cpuSprite = this.add.rectangle(
            this.playerIsLeft ? PLAYER_INITIAL_X_RIGHT : PLAYER_INITIAL_X_LEFT, // プレイヤーと反対側
            gameHeight * 0.75, 60, 100, 0xff0000).setOrigin(0.5);

        this.signalObject = this.add.text(gameWidth / 2, gameHeight * 0.4, '！', { fontSize: '96px', color: '#FFFF00', fontStyle: 'bold' })
            .setOrigin(0.5)
            .setVisible(false);

        this.infoText = this.add.text(gameWidth / 2, gameHeight * 0.1, '', { fontSize: '28px', color: '#FFFFFF', align: 'center' }).setOrigin(0.5);
        this.resultText = this.add.text(gameWidth / 2, gameHeight * 0.55, '', { fontSize: '32px', color: '#FFFFFF', align: 'center' }).setOrigin(0.5);

        this.setGameState('waiting');

        this.input.on('pointerdown', this.handlePlayerInput, this);
        console.log('GameScene ready for touch input.');
    }

    update(time, delta) {
        // 毎フレームの処理（今回はあまり使わない）
    }

    setGameState(newState) {
        this.gameState = newState;
        this.playerInputEnabled = false;
        console.log("State changed to:", this.gameState);

        if (this.cpuTimer) { this.cpuTimer.remove(false); this.cpuTimer = null; }
        if (this.signalTimer) { this.signalTimer.remove(false); this.signalTimer = null; }

        switch (this.gameState) {
            case 'waiting':
                this.infoText.setText(`Opponent ${currentOpponent}/${MAX_OPPONENTS}\nTap Screen to Start`);
                this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false); // nullチェック追加

                // 位置と色をリセット（キャラクターが入れ替わっている可能性を考慮）
                this.playerSprite.setPosition(this.playerIsLeft ? PLAYER_INITIAL_X_LEFT : PLAYER_INITIAL_X_RIGHT, this.playerSprite.y);
                this.cpuSprite.setPosition(this.playerIsLeft ? PLAYER_INITIAL_X_RIGHT : PLAYER_INITIAL_X_LEFT, this.cpuSprite.y);
                this.playerSprite.setFillStyle(0x00ff00);
                this.cpuSprite.setFillStyle(0xff0000);

                this.playerReactTime = undefined;
                this.cpuReactTime = undefined;
                this.signalTime = undefined;
                this.playerInputEnabled = true;
                break;

            case 'ready':
                this.infoText.setText('Ready...');
                this.resultText.setText('');
                if(this.signalObject) this.signalObject.setVisible(false);
                this.playerInputEnabled = true;

                const waitTime = Phaser.Math.Between(1500, 4000); // MIN_WAIT_TIME, MAX_WAIT_TIME
                console.log(`Signal in ${waitTime} ms`);
                this.signalTimer = this.time.delayedCall(waitTime, this.showSignal, [], this);
                break;

            case 'signal':
                this.infoText.setText('NOW!');
                if(this.signalObject) this.signalObject.setVisible(true);
                this.signalTime = this.time.now;
                this.playerInputEnabled = true;

                const cpuReactionDelay = Phaser.Math.Between(cpuMinReact, cpuMaxReact);
                console.log(`CPU will react in ${cpuReactionDelay} ms (Min: ${cpuMinReact}, Max: ${cpuMaxReact})`);
                this.cpuTimer = this.time.delayedCall(cpuReactionDelay, this.handleCpuInput, [], this);
                break;

            case 'result':
                this.playerInputEnabled = false;
                this.infoText.setText(`Tap Screen to Retry/Next`);
                if(this.signalObject) this.signalObject.setVisible(false);
                // リトライ/次の相手への入力受付は結果表示後少し待ってから
                this.time.delayedCall(500, () => { this.playerInputEnabled = true; });
                break;
        }
    }

    showSignal() {
        if (this.gameState === 'ready') {
            // this.sound.play('signalSound'); // TODO: Add sound
            this.setGameState('signal');
        }
    }

    handlePlayerInput() {
        if (!this.playerInputEnabled) return;
        const currentTime = this.time.now;

        if (this.gameState === 'waiting') {
            this.setGameState('ready');
        } else if (this.gameState === 'ready') { // フライング
            console.log("Player: False Start!");
            this.playerReactTime = -1; // フライングを示す値
            this.cpuReactTime = 99999; // CPUは反応しない (大きな値)
            if (this.signalTimer) { this.signalTimer.remove(); this.signalTimer = null; }
            this.playerSprite.setFillStyle(0xaaaaaa);
            this.showResult();
        } else if (this.gameState === 'signal') {
            this.playerReactTime = currentTime - this.signalTime;
            console.log(`Player Reaction: ${this.playerReactTime.toFixed(2)} ms`);
            this.playerInputEnabled = false; // 一度入力したら終わり
            // this.playerSprite.setFillStyle(0x00ffff); // 斬る色 (演出で変更)

            // CPUが既に入力済みなら結果表示 (ほぼ起こらないはず)
            if (this.cpuReactTime !== undefined) {
                this.showResult();
            }
        } else if (this.gameState === 'result') {
            // 結果画面タップ時
            if (this.winLastRound) { // 直前のラウンドで勝利した場合
                if (currentOpponent < MAX_OPPONENTS) {
                    currentOpponent++;
                    this.scene.restart({ difficulty: currentDifficulty, opponentNum: currentOpponent });
                } else {
                    // 3人抜き達成
                    this.showGameClearScreen();
                }
            } else { // 敗北した場合
                this.scene.start('TitleScene'); // タイトルに戻る
            }
        }
    }

    handleCpuInput() {
        if (this.gameState === 'result' || this.gameState === 'waiting' || this.gameState === 'ready') {
            console.log('CPU input ignored due to gameState:', this.gameState);
            return;
        }
        if (this.signalTime === undefined) {
            console.error("signalTime is undefined in handleCpuInput. Aborting.");
            return; // signalTimeがないとおかしい
        }

        const currentTime = this.time.now;
        this.cpuReactTime = currentTime - this.signalTime;
        console.log(`CPU Reaction: ${this.cpuReactTime.toFixed(2)} ms`);
        // this.cpuSprite.setFillStyle(0xffa500); // 斬る色 (演出で変更)

        if (this.playerReactTime === undefined) { // プレイヤーがまだ反応していない
            this.playerReactTime = 9999; // プレイヤーは時間切れ
            console.log("Player did not react in time. CPU wins by default.");
            this.playerInputEnabled = false;
        }
        this.showResult();
    }

    showResult() {
        if (this.gameState === 'result' && !this.resultText.text) { // 既に結果表示中でテキスト未設定の場合のみ（二重呼び出し防止）
             // この条件は複雑なので、setGameStateの最初でgameStateをチェックする方が良い
        }
        if (this.gameState !== 'signal' && this.playerReactTime === -1 /*フライング時*/ ) {
             // フライングの場合は既にgameStateがresultになっていないので、この条件は不要
        } else if (this.gameState !== 'signal'){
            // console.warn("showResult called when not in 'signal' state and not flying. Current state:", this.gameState);
            // return; // 'signal' 状態以外では基本的に呼ばれないはず（フライングは例外）
        }


        // --- 斬撃演出 ---
        // 1. フラッシュ
        const flash = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.7)
            .setDepth(100); // 最前面に
        this.time.delayedCall(80, () => { flash.destroy(); }); // 0.08秒で消す

        // 2. 位置入れ替え (フラッシュ後)
        this.time.delayedCall(90, () => { // フラッシュが消える少し後
            this.playerIsLeft = !this.playerIsLeft; // 位置フラグを反転
            const playerTargetX = this.playerIsLeft ? PLAYER_INITIAL_X_LEFT : PLAYER_INITIAL_X_RIGHT;
            const cpuTargetX = this.playerIsLeft ? PLAYER_INITIAL_X_RIGHT : CPU_INITIAL_X_LEFT;

            // アニメーションで移動させたい場合は tween を使う
            // this.tweens.add({ targets: this.playerSprite, x: playerTargetX, duration: 100 });
            // this.tweens.add({ targets: this.cpuSprite, x: cpuTargetX, duration: 100 });
            // 今回は瞬時に入れ替え
            this.playerSprite.setX(playerTargetX);
            this.cpuSprite.setX(cpuTargetX);

            // 3. 勝敗判定と表示 (位置入れ替え後)
            this.performResultLogic();
        });
    }

    performResultLogic() {
        this.setGameState('result'); // ここで確実に result 状態にする

        let message = '';
        const pReact = this.playerReactTime === undefined ? Infinity : this.playerReactTime;
        const cReact = this.cpuReactTime === undefined ? Infinity : this.cpuReactTime;
        this.winLastRound = false; // 今回のラウンドの勝敗フラグ

        console.log(`Result Logic - Player: ${pReact}, CPU: ${cReact}`);

        if (pReact === -1) {
            message = `False Start!\nYOU LOSE`;
            this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact === 9999 && cReact < 9999) {
            message = `Too Slow!\nYOU LOSE\n(CPU: ${cReact.toFixed(0)} ms)`;
            this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact < cReact) {
            message = `YOU WIN!\n\nYOU: ${pReact.toFixed(0)} ms\nCPU: ${cReact.toFixed(0)} ms`;
            this.cpuSprite.setFillStyle(0xaaaaaa); // CPUが負け
            this.winLastRound = true;
            // スコア更新 (最速反応時間)
            this.updateBestReaction(pReact);
        } else if (pReact > cReact) {
            message = `YOU LOSE\n\nYOU: ${pReact.toFixed(0)} ms\nCPU: ${cReact.toFixed(0)} ms`;
            this.playerSprite.setFillStyle(0xaaaaaa); // プレイヤーが負け
        } else if (pReact === cReact && pReact !== 9999 && pReact !== -1 && pReact !== Infinity) {
            message = `DRAW!\n\nBOTH: ${pReact.toFixed(0)} ms`;
            // 引き分けは負け扱いとするか、再戦とするか？今回は負け扱いでタイトルへ
        } else {
            message = `An error occurred.\nTry Again`;
            console.error("Unexpected result condition in performResultLogic:", pReact, cReact);
            this.playerSprite.setFillStyle(0xaaaaaa);
        }

        if (this.winLastRound) {
            if (currentOpponent < MAX_OPPONENTS) {
                message += `\n\nTap for Opponent ${currentOpponent + 1}`;
            } else {
                message += `\n\nDifficulty Clear! Tap to Continue.`;
                this.updateClearCount(currentDifficulty);
            }
        } else {
             message += `\n\nTap to return to Title.`;
        }

        this.resultText.setText(message);
    }

    showGameClearScreen() {
        // 3人抜き達成時の処理
        console.log("All opponents defeated for difficulty:", currentDifficulty);
        // ここで特別なクリア画面に遷移するか、タイトルに戻るか
        // 今回はタイトルに戻る
        this.scene.start('TitleScene');
    }

    updateBestReaction(reactionTime) {
        if (reactionTime < 0 || reactionTime === 9999) return; // 無効な時間は記録しない

        const bestTime = parseFloat(localStorage.getItem('bestReactionTime')) || Infinity;
        if (reactionTime < bestTime) {
            localStorage.setItem('bestReactionTime', reactionTime.toFixed(0));
            console.log("New best reaction time:", reactionTime);
        }
    }

    updateClearCount(difficultyKey) {
        const key = `${difficultyKey}_clears`;
        let clears = parseInt(localStorage.getItem(key)) || 0;
        clears++;
        localStorage.setItem(key, clears.toString());
        console.log(`Difficulty ${difficultyKey} cleared ${clears} times.`);
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
    scene: [TitleScene, GameScene] // シーンを配列で登録
};

// --- Phaserゲームの初期化 ---
const game = new Phaser.Game(config);