// --- Phaserの設定 ---
const config = {
    type: Phaser.AUTO, // WebGLかCanvasかを自動選択
    width: 800,        // ゲーム画面の幅
    height: 600,       // ゲーム画面の高さ
    parent: 'game-container', // HTML内の描画先ID
    scene: {
        preload: preload, // アセット読み込み
        create: create,   // ゲームオブジェクト作成・初期設定
        update: update    // ゲームループ（毎フレーム実行）
    }
};

// --- グローバル変数 ---
let gameState;          // ゲームの状態 ('waiting', 'ready', 'signal', 'result')
let signalTime;         // 合図が表示された時刻
let playerReactTime;    // プレイヤーの反応時間 (ms)
let cpuReactTime;       // CPUの反応時間 (ms)
let signalObject;       // 「！」マークなどの合図オブジェクト
let infoText;           // 画面上部の指示テキスト
let resultText;         // 結果表示用テキスト
let playerInputEnabled; // プレイヤーの入力受付フラグ
let cpuTimer;           // CPUの反応タイマー
let signalTimer;        // 合図表示タイマー

// 難易度設定（調整可能）
const MIN_WAIT_TIME = 1500; // 合図が出るまでの最小待機時間 (ms)
const MAX_WAIT_TIME = 4000; // 合図が出るまでの最大待機時間 (ms)
const CPU_MIN_REACT = 150;  // CPUの最小反応時間 (ms) - この値を小さくすると強くなる
const CPU_MAX_REACT = 400;  // CPUの最大反応時間 (ms) - この値を小さくすると強くなる
const INPUT_KEY = 'SPACE';  // プレイヤーが使うキー

// --- Phaserゲームの初期化 ---
const game = new Phaser.Game(config);

// --- アセット読み込み ---
function preload() {
    // ここで画像や音声ファイルを読み込む
    // 例: this.load.image('player', 'assets/player.png');
    // 例: this.load.image('signal', 'assets/signal.png');
    // 画像がない場合は、create関数内で図形を描画して代用します
    console.log('Preloading assets...');
}

// --- ゲームオブジェクト作成・初期設定 ---
function create() {
    console.log('Creating game objects...');
    this.cameras.main.setBackgroundColor('#4488AA'); // 背景色

    // --- オブジェクト描画 (画像がない場合の代替) ---
    // プレイヤー (緑の四角形)
    this.playerSprite = this.add.rectangle(200, 450, 80, 120, 0x00ff00).setOrigin(0.5);
    // CPU (赤の四角形)
    this.cpuSprite = this.add.rectangle(600, 450, 80, 120, 0xff0000).setOrigin(0.5);
    // 合図 (黄色の大きな「！」テキスト) - 初期状態は非表示
    signalObject = this.add.text(400, 250, '！', { fontSize: '128px', color: '#FFFF00', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setVisible(false);

    // --- テキスト表示 ---
    infoText = this.add.text(400, 50, '', { fontSize: '32px', color: '#FFFFFF' }).setOrigin(0.5);
    resultText = this.add.text(400, 350, '', { fontSize: '40px', color: '#FFFFFF', align: 'center' }).setOrigin(0.5);

    // --- 初期状態設定 ---
    setGameState.call(this, 'waiting'); // thisを束縛して呼び出す

    // --- 入力設定 ---
    this.input.keyboard.on(`keydown-${INPUT_KEY}`, handlePlayerInput, this); // 指定キーの入力イベントを監視
    console.log('Game ready.');
}

// --- ゲームループ (毎フレーム更新) ---
function update(time, delta) {
    // gameStateに応じて特定の処理を行う場合などに使う
    // (今回は主にイベント駆動なので、updateはシンプル)
}

// --- ゲーム状態を設定する関数 ---
function setGameState(newState) {
    // `this` は呼び出し元のSceneオブジェクトを指すようにする
    gameState = newState;
    playerInputEnabled = false; // 基本的に入力無効から開始
    console.log("State changed to:", gameState);

    // タイマーが動いていればクリア
    if (cpuTimer) cpuTimer.remove(false); // falseでコールバック実行を防ぐ
    if (signalTimer) signalTimer.remove(false);

    switch (gameState) {
        case 'waiting': // 開始待ち
            infoText.setText(`Press ${INPUT_KEY} to Start`);
            resultText.setText('');
            signalObject.setVisible(false);
            // アニメーションがあれば待機状態に
            this.playerSprite.setFillStyle(0x00ff00); // 色をリセット
            this.cpuSprite.setFillStyle(0xff0000);    // 色をリセット
            playerInputEnabled = true; // 開始キーを受け付ける
            break;

        case 'ready': // 合図待ち ("待て！"の状態)
            infoText.setText('Ready...');
            resultText.setText('');
            signalObject.setVisible(false);
            playerInputEnabled = true; // フライング判定のため入力受付

            // ランダムな時間後に合図を出すタイマー
            const waitTime = Phaser.Math.Between(MIN_WAIT_TIME, MAX_WAIT_TIME);
            console.log(`Signal in ${waitTime} ms`);
            signalTimer = this.time.delayedCall(waitTime, showSignal, [], this);
            break;

        case 'signal': // 合図表示 ("斬！"の状態)
            infoText.setText('NOW!');
            signalObject.setVisible(true);
            signalTime = this.time.now; // 合図が出た時刻を記録
            playerInputEnabled = true; // プレイヤーの反応入力を受け付け

            // CPUの反応タイマーを設定
            const cpuReactionDelay = Phaser.Math.Between(CPU_MIN_REACT, CPU_MAX_REACT);
            console.log(`CPU will react in ${cpuReactionDelay} ms`);
            cpuTimer = this.time.delayedCall(cpuReactionDelay, handleCpuInput, [], this);
            break;

        case 'result': // 結果表示
            playerInputEnabled = false; // 結果表示中は入力停止
            infoText.setText(`Press ${INPUT_KEY} to Retry`);
            signalObject.setVisible(false); // 合図は消す
            // リトライを受け付けるために少し待ってから有効にする
            this.time.delayedCall(500, () => { playerInputEnabled = true; });
            break;
    }
}

// --- 合図を表示する関数 ---
function showSignal() {
    // `this` は呼び出し元のSceneオブジェクト
    if (gameState === 'ready') { // フライングなどでキャンセルされていないか確認
        setGameState.call(this, 'signal');
        // ここで合図の音などを鳴らす
        // this.sound.play('signalSound');
    }
}

// --- プレイヤーの入力を処理する関数 ---
function handlePlayerInput() {
    // `this` は呼び出し元のSceneオブジェクト
    if (!playerInputEnabled) return; // 入力が有効でなければ無視

    const currentTime = this.time.now;

    if (gameState === 'waiting') { // 開始
        setGameState.call(this, 'ready');
    } else if (gameState === 'ready') { // フライング！
        console.log("Player: False Start!");
        playerReactTime = -1; // フライングを示す値
        cpuReactTime = 9999; // CPUは反応しない
        if (signalTimer) signalTimer.remove(); // 合図タイマーを止める
        // フライング演出（例：プレイヤーの色を変える）
        this.playerSprite.setFillStyle(0xaaaaaa); //灰色に
        showResult.call(this);
    } else if (gameState === 'signal') { // 正常な反応
        playerReactTime = currentTime - signalTime;
        console.log(`Player Reaction: ${playerReactTime.toFixed(2)} ms`);
        playerInputEnabled = false; // 一度入力したら終わり
        // プレイヤーの斬る演出（例：色を変える）
        this.playerSprite.setFillStyle(0x00ffff); // 水色に
        // CPUの反応がまだなら待つ。CPUが反応済みなら即座に結果表示へ (handleCpuInputで判定される)
    } else if (gameState === 'result') { // リトライ
        setGameState.call(this, 'waiting');
    }
}

// --- CPUの反応を処理する関数 ---
function handleCpuInput() {
    // `this` は呼び出し元のSceneオブジェクト
    // gameStateが 'signal' (プレイヤーがまだ押してない) or 'signal'後のプレイヤー入力待ち状態でのみ有効
    if (gameState !== 'signal' && playerReactTime === undefined) return; // playerReactTimeが未定義=プレイヤー未入力

    const currentTime = this.time.now;
    // cpuTimer.delayは設定した遅延時間
    cpuReactTime = currentTime - signalTime; // CPUの実際の反応時間
    console.log(`CPU Reaction: ${cpuReactTime.toFixed(2)} ms`);

    // CPUの斬る演出（例：色を変える）
    this.cpuSprite.setFillStyle(0xffa500); // オレンジ色に

    // プレイヤーがまだ入力していない場合 (CPUが先に反応した)
    if (gameState === 'signal') {
        playerReactTime = 9999; // プレイヤーは時間切れ扱い
        console.log("Player: Too Slow!");
        playerInputEnabled = false; // プレイヤーの入力受付終了
    }

    // 勝敗判定へ
    showResult.call(this);
}

// --- 結果を表示する関数 ---
function showResult() {
    // `this` は呼び出し元のSceneオブジェクト
    setGameState.call(this, 'result'); // 結果表示状態へ

    let message = '';
    if (playerReactTime === -1) {
        message = `False Start!\nYOU LOSE`;
    } else if (playerReactTime === 9999) {
        message = `Too Slow!\nYOU LOSE\n(CPU: ${cpuReactTime.toFixed(0)} ms)`;
    } else if (playerReactTime < cpuReactTime) {
        message = `YOU WIN!\n\nYOU: ${playerReactTime.toFixed(0)} ms\nCPU: ${cpuReactTime.toFixed(0)} ms`;
        // 勝利演出
        this.cpuSprite.setFillStyle(0xaaaaaa); // 負けたCPUを灰色に
    } else if (playerReactTime > cpuReactTime) {
        message = `YOU LOSE\n\nYOU: ${playerReactTime.toFixed(0)} ms\nCPU: ${cpuReactTime.toFixed(0)} ms`;
        // 敗北演出
        this.playerSprite.setFillStyle(0xaaaaaa); // 負けたプレイヤーを灰色に
    } else {
        message = `DRAW!\n\nBOTH: ${playerReactTime.toFixed(0)} ms`;
        // 引き分け演出
    }

    resultText.setText(message);

    // 勝敗に応じたサウンドなどを再生
    // if (playerReactTime < cpuReactTime && playerReactTime !== -1) this.sound.play('winSound');
    // else this.sound.play('loseSound');

    // 変数リセット（リトライに備える）
    playerReactTime = undefined;
    cpuReactTime = undefined;
}