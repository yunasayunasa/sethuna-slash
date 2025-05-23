// --- Phaserの設定 ---
const config = {
    type: Phaser.AUTO,
    width: 450,         // ゲーム画面の幅 (縦長に変更)
    height: 800,        // ゲーム画面の高さ (縦長に変更)
    parent: 'game-container',
    scale: { // スケーリング設定を追加
        mode: Phaser.Scale.FIT, // アスペクト比を維持して画面にフィットさせる
        autoCenter: Phaser.Scale.CENTER_BOTH // 画面中央に配置
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// --- グローバル変数 (変更なし) ---
let gameState;
let signalTime;
let playerReactTime;
let cpuReactTime;
let signalObject;
let infoText;
let resultText;
let playerInputEnabled;
let cpuTimer;
let signalTimer;

// 難易度設定（調整可能）
const MIN_WAIT_TIME = 1500;
const MAX_WAIT_TIME = 4000;
const CPU_MIN_REACT = 150;
const CPU_MAX_REACT = 400;
// const INPUT_KEY = 'SPACE'; // キー入力は使わないのでコメントアウトまたは削除

// --- Phaserゲームの初期化 ---
const game = new Phaser.Game(config);

// --- アセット読み込み (変更なし) ---
function preload() {
    console.log('Preloading assets...');
}

// --- ゲームオブジェクト作成・初期設定 ---
function create() {
    console.log('Creating game objects...');
    this.cameras.main.setBackgroundColor('#4488AA');

    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;

    // --- オブジェクト描画 (縦画面用に座標調整) ---
    // プレイヤー (画面下部左)
    this.playerSprite = this.add.rectangle(gameWidth * 0.25, gameHeight * 0.75, 60, 100, 0x00ff00).setOrigin(0.5);
    // CPU (画面下部右)
    this.cpuSprite = this.add.rectangle(gameWidth * 0.75, gameHeight * 0.75, 60, 100, 0xff0000).setOrigin(0.5);
    // 合図 (画面中央)
    signalObject = this.add.text(gameWidth / 2, gameHeight * 0.4, '！', { fontSize: '96px', color: '#FFFF00', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setVisible(false);

    // --- テキスト表示 (縦画面用に座標調整) ---
    infoText = this.add.text(gameWidth / 2, gameHeight * 0.1, '', { fontSize: '28px', color: '#FFFFFF', align: 'center' }).setOrigin(0.5);
    resultText = this.add.text(gameWidth / 2, gameHeight * 0.55, '', { fontSize: '32px', color: '#FFFFFF', align: 'center' }).setOrigin(0.5);

    // --- 初期状態設定 ---
    setGameState.call(this, 'waiting');

    // --- 入力設定 (画面タップに変更) ---
    this.input.on('pointerdown', handlePlayerInput, this); // 画面全体へのタップイベントを監視
    console.log('Game ready for touch input.');
}

// --- ゲームループ (変更なし) ---
function update(time, delta) {
    // gameStateに応じて特定の処理を行う場合などに使う
}

// --- ゲーム状態を設定する関数 ---
function setGameState(newState) {
    gameState = newState;
    playerInputEnabled = false;
    console.log("State changed to:", gameState);

    if (cpuTimer) cpuTimer.remove(false);
    if (signalTimer) signalTimer.remove(false);

    switch (gameState) {
        case 'waiting':
            infoText.setText(`Tap Screen to Start`); // テキスト変更
            resultText.setText('');
            signalObject.setVisible(false);
            this.playerSprite.setFillStyle(0x00ff00);
            this.cpuSprite.setFillStyle(0xff0000);
            playerInputEnabled = true;
            break;

        case 'ready':
            infoText.setText('Ready...');
            resultText.setText('');
            signalObject.setVisible(false);
            playerInputEnabled = true;

            const waitTime = Phaser.Math.Between(MIN_WAIT_TIME, MAX_WAIT_TIME);
            console.log(`Signal in ${waitTime} ms`);
            signalTimer = this.time.delayedCall(waitTime, showSignal, [], this);
            break;

        case 'signal':
            infoText.setText('NOW!');
            signalObject.setVisible(true);
            signalTime = this.time.now;
            playerInputEnabled = true;

            const cpuReactionDelay = Phaser.Math.Between(CPU_MIN_REACT, CPU_MAX_REACT);
            console.log(`CPU will react in ${cpuReactionDelay} ms`);
            cpuTimer = this.time.delayedCall(cpuReactionDelay, handleCpuInput, [], this);
            break;

        case 'result':
            playerInputEnabled = false;
            infoText.setText(`Tap Screen to Retry`); // テキスト変更
            signalObject.setVisible(false);
            this.time.delayedCall(500, () => { playerInputEnabled = true; });
            break;
    }
}

// --- 合図を表示する関数 (変更なし) ---
function showSignal() {
    if (gameState === 'ready') {
        setGameState.call(this, 'signal');
    }
}

// --- プレイヤーの入力を処理する関数 (入力ソースの変更に伴う修正はなし、ロジックは共通) ---
function handlePlayerInput() { // 引数 event は pointerdown から渡されるが、今回は未使用
    if (!playerInputEnabled) return;

    const currentTime = this.time.now;

    if (gameState === 'waiting') {
        setGameState.call(this, 'ready');
    } else if (gameState === 'ready') {
        console.log("Player: False Start!");
        playerReactTime = -1;
        cpuReactTime = 9999;
        if (signalTimer) signalTimer.remove();
        this.playerSprite.setFillStyle(0xaaaaaa);
        showResult.call(this);
    } else if (gameState === 'signal') {
        playerReactTime = currentTime - signalTime;
        console.log(`Player Reaction: ${playerReactTime.toFixed(2)} ms`);
        playerInputEnabled = false;
        this.playerSprite.setFillStyle(0x00ffff);
        // CPUの反応がまだなら待つ
    } else if (gameState === 'result') {
        setGameState.call(this, 'waiting');
    }
}

// --- CPUの反応を処理する関数 (変更なし) ---
function handleCpuInput() {
    if (gameState !== 'signal' && playerReactTime === undefined) return;

    const currentTime = this.time.now;
    cpuReactTime = currentTime - signalTime;
    console.log(`CPU Reaction: ${cpuReactTime.toFixed(2)} ms`);
    this.cpuSprite.setFillStyle(0xffa500);

    if (gameState === 'signal') {
        playerReactTime = 9999;
        console.log("Player: Too Slow!");
        playerInputEnabled = false;
    }
    showResult.call(this);
}

// --- 結果を表示する関数 (変更なし) ---
function showResult() {
    setGameState.call(this, 'result');

    let message = '';
    if (playerReactTime === -1) {
        message = `False Start!\nYOU LOSE`;
    } else if (playerReactTime === 9999) {
        message = `Too Slow!\nYOU LOSE\n(CPU: ${cpuReactTime.toFixed(0)} ms)`;
    } else if (playerReactTime < cpuReactTime) {
        message = `YOU WIN!\n\nYOU: ${playerReactTime.toFixed(0)} ms\nCPU: ${cpuReactTime.toFixed(0)} ms`;
        this.cpuSprite.setFillStyle(0xaaaaaa);
    } else if (playerReactTime > cpuReactTime) {
        message = `YOU LOSE\n\nYOU: ${playerReactTime.toFixed(0)} ms\nCPU: ${cpuReactTime.toFixed(0)} ms`;
        this.playerSprite.setFillStyle(0xaaaaaa);
    } else {
        message = `DRAW!\n\nBOTH: ${playerReactTime.toFixed(0)} ms`;
    }
    resultText.setText(message);

    playerReactTime = undefined;
    cpuReactTime = undefined;
}