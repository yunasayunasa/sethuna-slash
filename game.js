// --- グローバル設定 ---
const GAME_WIDTH = 450;
const GAME_HEIGHT = 800;
const PLAYER_INITIAL_X_LEFT = GAME_WIDTH * 0.25;
const PLAYER_INITIAL_X_RIGHT = GAME_WIDTH * 0.75;
const CPU_INITIAL_X_LEFT = GAME_WIDTH * 0.25;
const CPU_INITIAL_X_RIGHT = GAME_WIDTH * 0.75;

const DIFFICULTIES = {
    easy:   { name: 'やさしい', minReact: 250, maxReact: 500, color: 0x88ff88, cpuNames: ['若武者', '剣士', '達人'] },
    normal: { name: 'ふつう',   minReact: 150, maxReact: 400, color: 0xffff88, cpuNames: ['練達の士', '免許皆伝', '剣豪'] },
    hard:   { name: 'つよい',   minReact: 100, maxReact: 250, color: 0xff8888, cpuNames: ['修羅', '鬼神', '剣聖'] }
};
let currentDifficultyKey = 'normal'; // キー名で管理
let cpuMinReact = DIFFICULTIES[currentDifficultyKey].minReact;
let cpuMaxReact = DIFFICULTIES[currentDifficultyKey].maxReact;

const MAX_OPPONENTS = 3;
let currentOpponentIndex = 0; // 0, 1, 2 (配列のインデックスとして)

// --- Title Scene ---
class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        // Webフォントを読み込む場合 (例: Google Fonts)
        // this.load.script('webfont', 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js');
    }

    create() {
        /* // Webフォント使用例
        WebFont.load({
            google: {
                families: ['Press Start 2P'] // かっこいいピクセルフォントなど
            },
            active: () => { // フォント読み込み完了後にテキスト描画
                this.createTextObjects();
            }
        });
        if (!this.load.inflight.size) { // もしWebフォントを使わない場合は即時描画
           this.createTextObjects();
        }
        */
        this.createTextObjects(); // Webフォントを使わない場合は直接呼び出し
    }

    createTextObjects() {
        this.cameras.main.setBackgroundColor('#333333');
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        // A-1. タイトルロゴ
        this.add.text(gameWidth / 2, gameHeight * 0.15, '刹那の', {
            fontSize: '48px', color: '#ffffff', fontStyle: 'bold', /* fontFamily: '"Press Start 2P", cursive' */
        }).setOrigin(0.5);
        this.add.text(gameWidth / 2, gameHeight * 0.25, 'MI・KI・RI', {
            fontSize: '52px', color: '#ffff00', fontStyle: 'italic bold', /* fontFamily: '"Press Start 2P", cursive' */
        }).setOrigin(0.5);


        let yPos = gameHeight * 0.45;
        for (const diffKey in DIFFICULTIES) {
            const diff = DIFFICULTIES[diffKey];
            const button = this.add.rectangle(gameWidth / 2, yPos, gameWidth * 0.7, 65, diff.color)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    currentDifficultyKey = diffKey;
                    // cpuMinReact, cpuMaxReact は GameScene の init で設定
                    currentOpponentIndex = 0;
                    this.scene.start('GameScene', { difficulty: currentDifficultyKey, opponentIndex: currentOpponentIndex });
                });
            this.add.text(button.x, button.y, diff.name, { fontSize: '32px', color: '#000000', fontStyle: 'bold' }).setOrigin(0.5);
            yPos += 90;
        }

        // A-2. スコア表示
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
        // ... (プロパティ初期化は init で行うか、ここで undefined や null で宣言)
        this.playerSprite = null;
        this.cpuSprite = null;
        this.signalObject = null;
        this.infoText = null;
        this.resultText = null;
        this.cutsceneObjects = null; // カットシーン用オブジェクトグループ
    }

    init(data) {
         // ★★★修正ポイント★★★
        // data が存在し、かつプロパティが存在するか確認
        currentDifficultyKey = (data && data.difficulty !== undefined) ? data.difficulty : 'normal';
        currentOpponentIndex = (data && data.opponentIndex !== undefined) ? data.opponentIndex : 0;
        // A-5. 「つよい」難易度でのCPU強化
        const diffSetting = DIFFICULTIES[currentDifficultyKey];
        if (currentDifficultyKey === 'hard') {
            const baseMin = diffSetting.minReact;
            const baseMax = diffSetting.maxReact;
            // 相手が進むごとに少しずつ厳しくする (例: 0ms, -15ms, -30ms のように)
            const reductionFactor = currentOpponentIndex * 15; // 1人目=0, 2人目=15, 3人目=30
            cpuMinReact = Math.max(80, baseMin - reductionFactor); // 最低でも80ms
            cpuMaxReact = Math.max(150, baseMax - reductionFactor * 1.3); // 最低でも150ms (minよりmaxを大きく減らす)
            if (cpuMinReact >= cpuMaxReact - 10) cpuMinReact = cpuMaxReact - 20; // 矛盾しないように & 最小間隔20ms
        } else {
            cpuMinReact = diffSetting.minReact;
            cpuMaxReact = diffSetting.maxReact;
        }
        console.log(`Game Init: Diff ${currentDifficultyKey}, Opponent ${currentOpponentIndex + 1}, CPU React: ${cpuMinReact}-${cpuMaxReact}ms`);

        // GameScene固有のプロパティ初期化
        this.gameState = 'pre_battle'; // B. 最初はカットシーンから
        this.signalTime = undefined;
        this.playerReactTime = undefined;
        this.cpuReactTime = undefined;
        this.playerInputEnabled = false;
        this.cpuTimer = null;
        this.signalTimer = null;
        this.playerIsLeft = false; // プレイヤーは右から開始
        this.winLastRound = false;
    }

    preload() {
        console.log('GameScene Preloading...');
    }

    create() {
        console.log('GameScene Creating...');
        this.cameras.main.setBackgroundColor('#4488AA');
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        this.playerSprite = this.add.rectangle(0,0, 60, 100, 0x00ff00).setOrigin(0.5); // 初期位置は setGameState で設定
        this.cpuSprite = this.add.rectangle(0,0, 60, 100, 0xff0000).setOrigin(0.5);

        this.signalObject = this.add.text(gameWidth / 2, gameHeight * 0.4, '！', { fontSize: '120px', color: '#FFFF00', fontStyle: 'bold' }) // A-3. フォントサイズ調整
            .setOrigin(0.5)
            .setVisible(false);

        // A-3. フォントサイズ調整
        this.infoText = this.add.text(gameWidth / 2, gameHeight * 0.1, '', { fontSize: '32px', color: '#FFFFFF', align: 'center', lineSpacing: 8 }).setOrigin(0.5);
        this.resultText = this.add.text(gameWidth / 2, gameHeight * 0.58, '', { fontSize: '36px', color: '#FFFFFF', align: 'center', lineSpacing: 10 }).setOrigin(0.5);

        this.setGameState(this.gameState); // 初期ステート 'pre_battle' を設定

        this.input.on('pointerdown', this.handlePlayerInput, this);
    }

    setGameState(newState) {
        this.gameState = newState;
        this.playerInputEnabled = false;
        console.log("State changed to:", this.gameState);

        if (this.cpuTimer) { this.cpuTimer.remove(false); this.cpuTimer = null; }
        if (this.signalTimer) { this.signalTimer.remove(false); this.signalTimer = null; }

        // カットシーンオブジェクトの表示制御
        if (this.cutsceneObjects) {
            this.cutsceneObjects.setVisible(this.gameState === 'pre_battle');
        }

        switch (this.gameState) {
                case 'pre_battle':
                this.playerReactTime = undefined;
                this.cpuReactTime = undefined;
                this.signalTime = undefined;
                if (this.playerSprite) this.playerSprite.setVisible(false); // nullチェック追加
                if (this.cpuSprite) this.cpuSprite.setVisible(false);    // nullチェック追加
                if (this.signalObject) this.signalObject.setVisible(false); // nullチェック追加
                if (this.infoText) this.infoText.setText('');        // nullチェック追加
                if (this.resultText) this.resultText.setText('');      // nullチェック追加

                // ★★★修正ポイント★★★
                // this.showPreBattleCutscene(); // 直接呼び出すのをやめる
                this.time.delayedCall(10, this.showPreBattleCutscene, [], this); // 10ms後に呼び出す

                this.playerInputEnabled = true;
                break;

            case 'waiting':
                  if (this.playerSprite) { // nullチェック
                    this.playerSprite.setVisible(true);
                    this.playerSprite.setPosition(PLAYER_INITIAL_X_RIGHT, GAME_HEIGHT * 0.75);
                    this.playerSprite.setFillStyle(0x00ff00);
                }
                if (this.cpuSprite) { // nullチェック
                    this.cpuSprite.setVisible(true);
                    this.cpuSprite.setPosition(CPU_INITIAL_X_LEFT, GAME_HEIGHT * 0.75);
                    this.cpuSprite.setFillStyle(0xff0000);
                }
                // A-3. 日本語化
                this.infoText.setText(`相手: ${DIFFICULTIES[currentDifficultyKey].cpuNames[currentOpponentIndex]} (${currentOpponentIndex + 1}/${MAX_OPPONENTS})\n画面をタップして開始`);
                this.resultText.setText('');
                this.signalObject.setVisible(false);

                this.playerIsLeft = false; // プレイヤーは右から開始
                this.playerSprite.setPosition(PLAYER_INITIAL_X_RIGHT, GAME_HEIGHT * 0.75);
                this.cpuSprite.setPosition(CPU_INITIAL_X_LEFT, GAME_HEIGHT * 0.75);
                this.playerSprite.setFillStyle(0x00ff00);
                this.cpuSprite.setFillStyle(0xff0000);

                this.playerReactTime = undefined;
                this.cpuReactTime = undefined;
                this.signalTime = undefined;
                this.playerInputEnabled = true;
                break;

            case 'ready':
                this.infoText.setText('構え！'); // A-3. 日本語化
                this.resultText.setText('');
                this.signalObject.setVisible(false);
                this.playerInputEnabled = true;

                const waitTime = Phaser.Math.Between(1500, 3500); // 少し短縮＆固定
                console.log(`Signal in ${waitTime} ms`);
                this.signalTimer = this.time.delayedCall(waitTime, this.showSignal, [], this);
                break;

            case 'signal':
                this.infoText.setText('斬！'); // A-3. 日本語化
                this.signalObject.setVisible(true);
                this.signalTime = this.time.now;
                this.playerInputEnabled = true;

                const cpuReactionDelay = Phaser.Math.Between(cpuMinReact, cpuMaxReact);
                console.log(`CPU will react in ${cpuReactionDelay} ms (Min: ${cpuMinReact}, Max: ${cpuMaxReact})`);
                this.cpuTimer = this.time.delayedCall(cpuReactionDelay, this.handleCpuInput, [], this);
                break;

            case 'result':
                this.playerInputEnabled = false;
                 // A-3. 日本語化 (メッセージは performResultLogic で設定)
                this.signalObject.setVisible(false);
                this.time.delayedCall(600, () => { this.playerInputEnabled = true; }); // 少し長めに
                break;
        }
    }

    showPreBattleCutscene() { // B. カットシーン表示
          // ★★★修正ポイント★★★
        if (this.cutsceneObjects) {
            this.cutsceneObjects.clear(true, true); // 子を破棄し、グループも空にする
            this.cutsceneObjects.destroy();         // グループ自体を破棄
            this.cutsceneObjects = null;            // 参照をクリア
        }

        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;
        this.cutsceneObjects = this.add.group(); // 新しくグループを作成

        const bandHeight = gameHeight * 0.2;
        const band = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth * 0.9, bandHeight, 0x000000, 0.8);
        band.setStrokeStyle(2, 0xffffff);
        this.cutsceneObjects.add(band);

        const playerName = "あなた"; // 将来的に入力できるようにしても良い
        const cpuName = DIFFICULTIES[currentDifficultyKey].cpuNames[currentOpponentIndex];

        const vsText = this.add.text(gameWidth/2, gameHeight/2, `${playerName}\nVS\n${cpuName}`, {
            fontSize: '30px', color: '#ffffff', align: 'center', fontStyle: 'bold', lineSpacing: 8
        }).setOrigin(0.5);
        this.cutsceneObjects.add(vsText);

        const tapToStartText = this.add.text(gameWidth/2, gameHeight/2 + bandHeight/2 + 30, '画面をタップ', {
            fontSize: '22px', color: '#cccccc', align: 'center'
        }).setOrigin(0.5);
        this.cutsceneObjects.add(tapToStartText);

        this.cutsceneObjects.setVisible(true);
    }


    showSignal() {
        if (this.gameState === 'ready') {
            this.setGameState('signal');
        }
    }

    handlePlayerInput() {
        if (!this.playerInputEnabled) return;
        const currentTime = this.time.now;

        if (this.gameState === 'pre_battle') { // B. カットシーン中のタップ
            if (this.cutsceneObjects) this.cutsceneObjects.setVisible(false);
            this.setGameState('waiting');
        } else if (this.gameState === 'waiting') {
            this.setGameState('ready');
        } else if (this.gameState === 'ready') { // フライング
            this.playerReactTime = -1;
            this.cpuReactTime = 99999;
            if (this.signalTimer) { this.signalTimer.remove(); this.signalTimer = null; }
            this.playerSprite.setFillStyle(0xaaaaaa);
            this.performResultLogic(); // 演出なしで直接結果ロジックへ
        } else if (this.gameState === 'signal') {
            this.playerReactTime = currentTime - this.signalTime;
            this.playerInputEnabled = false;
            if (this.cpuReactTime !== undefined) { // CPUが同時か先に反応した場合
                this.showResult();
            } // そうでなければCPUの反応を待つ (cpuTimerが発火してhandleCpuInputが呼ばれる)
       } else if (this.gameState === 'result') {
            if (this.winLastRound) { // 直前のラウンドで勝利した場合
                if (currentOpponentIndex < MAX_OPPONENTS - 1) {
                    currentOpponentIndex++;
                    console.log(`Restarting for Opponent Index: ${currentOpponentIndex}, Difficulty: ${currentDifficultyKey}`); // ログ追加
                    // ★★★修正ポイント★★★
                    // restart に渡すデータはオブジェクトであることを確認
                    this.scene.restart({ difficulty: currentDifficultyKey, opponentIndex: currentOpponentIndex });
                } else {
                    // 3人抜き達成
                    this.resultText.setText(`${DIFFICULTIES[currentDifficultyKey].name} 制覇！\nタップしてタイトルへ`); // メッセージ更新
                    // この後、タップでタイトルに戻る処理は winLastRound = false のルートを通るようにするか、
                    // 別途フラグ管理が必要。ここでは単純化のため、次のタップでタイトルへ。
                    this.winLastRound = false; // クリアしたので、次のタップはタイトルバック用
                    // this.scene.start('TitleScene'); // 即座にタイトルに戻す場合
                }
            } else { // 敗北した場合、または3人抜き達成後のタップ
                this.scene.start('TitleScene');
            }
        }}

    handleCpuInput() {
        if (this.gameState !== 'signal') return; // signal状態以外ではCPUの反応は処理しない
        if (this.signalTime === undefined) return;

        this.cpuReactTime = this.time.now - this.signalTime;

        if (this.playerReactTime === undefined) { // プレイヤーがまだ反応していない
            this.playerReactTime = 9999;
            this.playerInputEnabled = false;
        }
        this.showResult(); // プレイヤーとCPU両方の反応が出揃った(またはタイムアウト)
    }

    showResult() {
        // gameStateが'result'に遷移する前に演出を行うため、ここでのgameStateチェックは慎重に
        // ただし、フライングの場合は直接 performResultLogic を呼ぶので、この関数は通らない
        if (this.gameState !== 'signal') {
            console.warn("showResult called when not in 'signal' state. State:", this.gameState);
            // フライング以外でここに来る場合は問題の可能性
            if (this.playerReactTime !== -1) return;
        }

        const flash = this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.7)
            .setDepth(100);
        this.time.delayedCall(80, () => { flash.destroy(); });

        this.time.delayedCall(90, () => {
            this.playerIsLeft = !this.playerIsLeft;
            this.playerSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_LEFT : PLAYER_INITIAL_X_RIGHT);
            this.cpuSprite.setX(this.playerIsLeft ? PLAYER_INITIAL_X_RIGHT : CPU_INITIAL_X_LEFT);
            this.performResultLogic();
        });
    }

    performResultLogic() {
        this.setGameState('result'); // まず結果状態に

        let message = '';
        const pReact = this.playerReactTime === undefined ? Infinity : this.playerReactTime;
        const cReact = this.cpuReactTime === undefined ? Infinity : this.cpuReactTime;
        this.winLastRound = false;

        console.log(`Result Logic - Player: ${pReact.toFixed(0)}, CPU: ${cReact.toFixed(0)}`);

        if (pReact === -1) { // フライング
            message = `お手つき！\nあなたの負け`; // A-3. 日本語化
            this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact === 9999 && cReact < 9999) { // プレイヤー時間切れ
            message = `遅い！\nあなたの負け\n(相手: ${cReact.toFixed(0)} ms)`;
            this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact < cReact) { // プレイヤー勝利
            message = `あなたの勝ち！\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            this.cpuSprite.setFillStyle(0xaaaaaa);
            this.winLastRound = true;
            this.updateBestReaction(pReact);
        } else if (pReact > cReact) { // CPU勝利
            message = `あなたの負け\n\nあなた: ${pReact.toFixed(0)} ms\n相手: ${cReact.toFixed(0)} ms`;
            this.playerSprite.setFillStyle(0xaaaaaa);
        } else if (pReact === cReact && pReact !== 9999 && pReact !== -1 && pReact !== Infinity) { // 引き分け
            message = `引き分け！\n\n両者: ${pReact.toFixed(0)} ms`;
            // 引き分けは負け扱いとするか？今回は負け（タイトルへ）でwinLastRoundはfalseのまま
        } else {
            message = `予期せぬエラー\nもう一度試してください`;
            this.playerSprite.setFillStyle(0xaaaaaa);
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
        this.resultText.setText(message);
    }

    showGameClearScreen() { // 3人抜き達成時 (performResultLogic から呼ばれる)
        console.log("All opponents defeated for difficulty:", currentDifficultyKey);
        // この関数は実質的に performResultLogic の結果表示分岐に含まれるため、単独では不要かも
        // タイトルへ戻る処理は handlePlayerInput の 'result' state で行う
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

const game = new Phaser.Game(config);